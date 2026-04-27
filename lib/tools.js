// /lib/tools.js — Beacon's tool kit. Tools the model can call to actually
// operate on Drive files: search, clone templates, read/write Sheets cells,
// replace text in Slides. Anthropic API tool-use format.
//
// Each tool exports a definition (for the API call) + an execute(input,
// accessToken) function. The chat loop wires them together.

// ---- Definitions ----------------------------------------------------------

const TOOL_DEFINITIONS = [
  {
    name: 'find_drive_file',
    description: 'Search the user\'s Google Drive for files by name. Returns up to 10 matches with id, name, mimeType, modifiedTime, webViewLink. Use this FIRST whenever the user references a file by name (e.g., "my Nestlé tracker", "the Q3 deck").',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Name or partial name to search for. Be specific (e.g., "Nestlé Q3 Tracker") rather than generic ("tracker"). Searches by Drive `name contains` operator.'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'read_sheet_range',
    description: 'Read cells from a Google Sheet. Use this AFTER finding a sheet, BEFORE writing, to inspect existing structure (headers, columns, where data starts). Returns a 2D array of values.',
    input_schema: {
      type: 'object',
      properties: {
        file_id: { type: 'string', description: 'The Drive file ID of the spreadsheet.' },
        range: {
          type: 'string',
          description: 'A1 notation: "Sheet1!A1:Z100" for a specific range, or just "Sheet1" for whole sheet. Leave off sheet name to use first sheet.'
        }
      },
      required: ['file_id', 'range']
    }
  },
  {
    name: 'clone_drive_file',
    description: 'Make a working copy of a Drive file. Use this when the user wants to "fill out a template" or "create a new copy of" something — clone first, then modify the clone, never the original. Preserves all formatting, formulas, layouts, colors.',
    input_schema: {
      type: 'object',
      properties: {
        file_id: { type: 'string', description: 'The Drive file ID to copy.' },
        new_name: {
          type: 'string',
          description: 'Name for the new copy. Be descriptive (e.g., "Nestlé Q3 2026 Tracker" not "Copy of Tracker").'
        }
      },
      required: ['file_id', 'new_name']
    }
  },
  {
    name: 'update_sheet_cells',
    description: 'Write values to specific cells in a Google Sheet. The Sheet must already exist (typically a clone of a template). Values is a 2D array of rows.',
    input_schema: {
      type: 'object',
      properties: {
        file_id: { type: 'string', description: 'The Drive file ID of the spreadsheet.' },
        range: {
          type: 'string',
          description: 'A1 notation start cell or range, e.g., "Sheet1!A2" (range expanded by values shape) or "Sheet1!A2:C5" (explicit).'
        },
        values: {
          type: 'array',
          description: '2D array. Each inner array is one row of cells.',
          items: { type: 'array', items: {} }
        }
      },
      required: ['file_id', 'range', 'values']
    }
  },
  {
    name: 'replace_slide_text',
    description: 'Find/replace text across all slides in a Google Slides presentation. Useful for filling in template placeholders like "{{client_name}}", "[DATE]", or "Q[N]". Multiple replacements run in one batch.',
    input_schema: {
      type: 'object',
      properties: {
        file_id: { type: 'string', description: 'The Drive file ID of the presentation.' },
        replacements: {
          type: 'array',
          description: 'List of find/replace pairs to apply across all slides.',
          items: {
            type: 'object',
            properties: {
              find: { type: 'string' },
              replace: { type: 'string' }
            },
            required: ['find', 'replace']
          }
        }
      },
      required: ['file_id', 'replacements']
    }
  }
];

// ---- Executors ------------------------------------------------------------

async function gFetch(accessToken, url, init) {
  const resp = await fetch(url, {
    ...(init || {}),
    headers: {
      Authorization: 'Bearer ' + accessToken,
      ...((init && init.headers) || {})
    }
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error('API ' + resp.status + ': ' + text.slice(0, 400));
  }
  return resp;
}

async function find_drive_file(input, accessToken) {
  const escaped = (input.query || '').replace(/'/g, "\\'");
  const params = new URLSearchParams();
  params.set('q', `name contains '${escaped}' and trashed = false`);
  params.set('fields', 'files(id,name,mimeType,modifiedTime,webViewLink,size)');
  params.set('pageSize', '10');
  params.set('orderBy', 'modifiedTime desc');
  const resp = await gFetch(accessToken, 'https://www.googleapis.com/drive/v3/files?' + params.toString());
  const data = await resp.json();
  return {
    matches: (data.files || []).map(f => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      modifiedTime: f.modifiedTime,
      webViewLink: f.webViewLink,
      size: f.size
    }))
  };
}

async function read_sheet_range(input, accessToken) {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' +
    encodeURIComponent(input.file_id) + '/values/' + encodeURIComponent(input.range);
  const resp = await gFetch(accessToken, url);
  const data = await resp.json();
  return { range: data.range, values: data.values || [] };
}

async function clone_drive_file(input, accessToken) {
  const url = 'https://www.googleapis.com/drive/v3/files/' +
    encodeURIComponent(input.file_id) +
    '/copy?fields=id,name,mimeType,webViewLink,modifiedTime';
  const resp = await gFetch(accessToken, url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: input.new_name })
  });
  const data = await resp.json();
  return {
    id: data.id,
    name: data.name,
    mimeType: data.mimeType,
    webViewLink: data.webViewLink,
    modifiedTime: data.modifiedTime
  };
}

async function update_sheet_cells(input, accessToken) {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' +
    encodeURIComponent(input.file_id) + '/values/' +
    encodeURIComponent(input.range) +
    '?valueInputOption=USER_ENTERED';
  const resp = await gFetch(accessToken, url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: input.values })
  });
  const data = await resp.json();
  return {
    updatedRange: data.updatedRange,
    updatedRows: data.updatedRows,
    updatedColumns: data.updatedColumns,
    updatedCells: data.updatedCells
  };
}

async function replace_slide_text(input, accessToken) {
  const requests = (input.replacements || []).map(r => ({
    replaceAllText: {
      containsText: { text: r.find, matchCase: false },
      replaceText: r.replace
    }
  }));
  if (!requests.length) return { replacements: [] };
  const url = 'https://slides.googleapis.com/v1/presentations/' +
    encodeURIComponent(input.file_id) + ':batchUpdate';
  const resp = await gFetch(accessToken, url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests })
  });
  const data = await resp.json();
  return {
    replies: (data.replies || []).map(r => ({
      occurrencesChanged: (r.replaceAllText && r.replaceAllText.occurrencesChanged) || 0
    }))
  };
}

const EXECUTORS = {
  find_drive_file,
  read_sheet_range,
  clone_drive_file,
  update_sheet_cells,
  replace_slide_text
};

async function executeTool(name, input, accessToken) {
  const fn = EXECUTORS[name];
  if (!fn) throw new Error('Unknown tool: ' + name);
  return fn(input || {}, accessToken);
}

module.exports = {
  TOOL_DEFINITIONS,
  executeTool,
  EXECUTORS
};

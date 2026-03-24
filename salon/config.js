// Salon Demo — Site Configuration
// Edit this file to customize the site for a new prospect.
// All business-specific content is defined here.
window.SITE_CONFIG = {

  // === PAGE META ===
  pageTitle: "Velvet & Vine Salon | Austin Hair Salon",
  metaDescription: "Velvet & Vine Salon in Austin offers cuts, color, and care in a boutique South Congress-inspired space.",

  // === IDENTITY ===
  businessName: "Velvet & Vine Salon",
  businessNameShort: "Velvet & Vine",

  // === CONTACT ===
  phone: "(512) 555-0147",
  phoneTelHref: "tel:+15125550147",
  email: "hello@velvetandvine.com",
  address: "2204 S Congress Ave",
  addressLine2: "Austin TX 78704",
  hours: "Tue\u2013Sat 10am\u20137pm",
  hoursSunday: "Sun 11am\u20135pm",

  // === NAV ===
  navBookBtn: "Book Appointment",

  // === HERO ===
  heroLabel: "Austin\u2019s Boutique Salon",
  heroHeadline: "Your Best Hair Starts Here",
  heroSubtext: "Cuts, color, and care by stylists who take the time to listen. Located on South Congress in the heart of Austin.",
  heroImage: "https://images.pexels.com/photos/3993453/pexels-photo-3993453.jpeg?auto=compress&cs=tinysrgb&w=1600",
  heroImageAlt: "Woman getting a professional haircut at a salon",
  heroCta1: "Book Your Appointment",
  heroCta2: "View Services",

  // === SERVICES / MENU (two-column menu with unique items, numbered individually) ===
  servicesLabel: "What We Offer",
  servicesTitle: "Services & Pricing",

  // -- Cuts & Color column --
  menuCol1Title: "Cuts & Color",
  menuItem1Name: "Women\u2019s Haircut",
  menuItem1Price: "$65\u2013$95",
  menuItem2Name: "Men\u2019s Haircut",
  menuItem2Price: "$40\u2013$55",
  menuItem3Name: "Balayage / Highlights",
  menuItem3Price: "$150\u2013$250",
  menuItem4Name: "Full Color",
  menuItem4Price: "$120\u2013$180",
  menuItem5Name: "Color Correction",
  menuItem5Price: "Starting at $200",

  // -- Styling & Care column --
  menuCol2Title: "Styling & Care",
  menuItem6Name: "Blowout",
  menuItem6Price: "$55\u2013$75",
  menuItem7Name: "Deep Conditioning",
  menuItem7Price: "$45",
  menuItem8Name: "Keratin Treatment",
  menuItem8Price: "$250\u2013$350",
  menuItem9Name: "Bridal / Special Event",
  menuItem9Price: "Starting at $200",
  menuItem10Name: "Extensions Consultation",
  menuItem10Price: "Complimentary",

  // === ABOUT / STORY ===
  aboutLabel: "Our Story",
  aboutTitle: "Austin\u2019s Boutique Salon Since 2018",
  aboutText1: "Velvet & Vine was created for clients who want great hair without the rushed salon experience. We start every appointment with a conversation, then tailor each cut, color, and treatment to your routine and style goals.",
  aboutText2: "Our stylists blend technical training with Austin creativity. Whether you\u2019re refreshing your everyday look or getting ready for a special event, you\u2019ll leave with hair that feels effortless, polished, and genuinely you.",

  // === TEAM (each has unique photo, numbered individually) ===
  teamLabel: "The Team",
  teamTitle: "Meet the Stylists",
  team1Name: "Taylor R.",
  team1Image: "https://images.pexels.com/photos/7440054/pexels-photo-7440054.jpeg?auto=compress&cs=tinysrgb&w=400",
  team1ImageAlt: "Stylist Taylor R. working with a client",
  team2Name: "Jade M.",
  team2Image: "https://images.pexels.com/photos/3993453/pexels-photo-3993453.jpeg?auto=compress&cs=tinysrgb&w=400&h=540&fit=crop",
  team2ImageAlt: "Stylist Jade M. at the salon",
  team3Name: "Sofia L.",
  team3Image: "https://images.pexels.com/photos/3993311/pexels-photo-3993311.jpeg?auto=compress&cs=tinysrgb&w=400",
  team3ImageAlt: "Stylist Sofia L. coloring a client\u2019s hair",

  // === GALLERY (each has unique photo, numbered individually) ===
  galleryLabel: "Our Work",
  galleryTitle: "Style Gallery",
  gallery1Image: "https://images.pexels.com/photos/3993311/pexels-photo-3993311.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop",
  gallery1Alt: "Hair coloring service in progress",
  gallery1Label: "Color & Highlights",
  gallery2Image: "https://images.pexels.com/photos/3356170/pexels-photo-3356170.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop",
  gallery2Alt: "Stylist cutting hair with scissors",
  gallery2Label: "Precision Cut",
  gallery3Image: "https://images.pexels.com/photos/7440133/pexels-photo-7440133.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop",
  gallery3Alt: "Stylist blow drying client\u2019s hair",
  gallery3Label: "Blowout",
  gallery4Image: "https://images.pexels.com/photos/6487882/pexels-photo-6487882.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop",
  gallery4Alt: "Close-up detail of hair cutting",
  gallery4Label: "Detail Work",
  gallery5Image: "https://images.pexels.com/photos/8467969/pexels-photo-8467969.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop",
  gallery5Alt: "Flat iron styling service",
  gallery5Label: "Keratin & Styling",
  gallery6Image: "https://images.pexels.com/photos/7440054/pexels-photo-7440054.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop",
  gallery6Alt: "Full service color and styling",
  gallery6Label: "Full Service Color",

  // === REVIEWS (identical structure, uses data-cfg-list) ===
  reviewsLabel: "Client Love",
  reviewsTitle: "What Clients Are Saying",
  reviews: [
    {
      text: "I\u2019ve been coming here for 2 years and Taylor always knows exactly what I want. The color grows out beautifully every time.",
      attribution: "&mdash; Andrea K."
    },
    {
      text: "Jade fixed a bad color correction from another salon and made me feel so comfortable through the whole process.",
      attribution: "&mdash; Melissa J."
    },
    {
      text: "Warm team, gorgeous space, and Sofia gave me the best blowout I\u2019ve had in Austin. Highly recommend.",
      attribution: "&mdash; Carina P."
    }
  ],

  // === CTA ===
  ctaTitle: "Ready for Your Best Hair Day?",
  ctaText: "New clients always welcome. Walk-ins based on availability.",
  ctaButton: "Book Online",
  ctaPhoneLabel: "Or call us:",
  ctaPhone: "(512) 555-0147",

  // === FOOTER ===
  footerDescription: "Austin\u2019s boutique salon for cuts, color, and care. Located on South Congress since 2018.",
  footerLegal: "&copy; 2026 Velvet & Vine Salon. All rights reserved."
};

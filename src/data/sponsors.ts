export interface Sponsor {
  id: string;
  name: string;
  logo: string;
  domain: string;
  description: string;
  website: string;
  featured?: boolean;
}

export interface PartnerBenefit {
  title: string;
  description: string;
  metric?: string;
  icon: string;
}

export const SPONSORS_DATA: Sponsor[] = [
  {
    id: "siiec",
    name: "SRM Innovation and Incubation Centre (SIIEC)",
    logo: "/sponsors/SIIEC.png",
    domain: "Incubation, R&D Facilities & Innovation Ecosystem",
    description: "Provides critical infrastructural support, state-of-the-art laboratory spaces, and institutional backing empowering our multi-disciplinary engineering initiatives.",
    website: "https://www.srmist.edu.in/",
    featured: true,
  },
  {
    id: "solidworks",
    name: "Dassault Systèmes SOLIDWORKS",
    logo: "/sponsors/Solidworks.png",
    domain: "3D CAD, Kinematics & Structural FEA",
    description: "Powers our mechanical engineering division with parametric 3D modeling, stress analysis, and motion simulation for robust robot chassis architectures.",
    website: "https://www.solidworks.com/",
    featured: true,
  },
  {
    id: "matlab",
    name: "MathWorks MATLAB",
    logo: "/sponsors/Matlab.jpg",
    domain: "Numerical Computing & Dynamic Controls",
    description: "Accelerates our autonomous robotics pipeline with dynamic control algorithm simulation, sensor fusion filtering, and trajectory optimization.",
    website: "https://www.mathworks.com/",
    featured: true,
  },
  {
    id: "ansys",
    name: "Ansys",
    logo: "/sponsors/Ansys.jpg",
    domain: "Multiphysics Engineering Simulation",
    description: "Delivers comprehensive structural mechanics, thermal dissipation, and computational fluid dynamics simulations for high-stress mechanism verification.",
    website: "https://www.ansys.com/",
    featured: true,
  },
  {
    id: "altium",
    name: "Altium",
    logo: "/sponsors/Altium.png",
    domain: "High-Speed PCB Design & EDA Tooling",
    description: "Equips our electronics team with industrial schematic capture, impedance control routing, and multi-layer embedded PCB layout software.",
    website: "https://www.altium.com/",
  },
  {
    id: "pcb-power",
    name: "PCB Power Market",
    logo: "/sponsors/PCB_Power.png",
    domain: "Precision PCB Fabrication & SMT Assembly",
    description: "Manufactures custom industrial-grade printed circuit boards, high-current power distribution units, and sensor break-outs with rapid turnaround.",
    website: "https://www.pcbpower.com/",
  },
  {
    id: "novoflex",
    name: "Novoflex",
    logo: "/sponsors/Novoflex.png",
    domain: "Cable Management & Electrical Harnessing",
    description: "Supplies precision wire management, cable ties, sleeves, and routing components that keep our robots' internal wiring secure and reliable.",
    website: "https://novoflex.in/",
  },
  {
    id: "solidspace",
    name: "Solidspace",
    logo: "/sponsors/Solidspace.png",
    domain: "Rapid Prototyping & Additive Manufacturing",
    description: "Enables fast mechanical iteration through precision 3D printing and custom bracket manufacturing during competition development cycles.",
    website: "https://solidspace.in/",
  },
];

export const PARTNER_BENEFITS: PartnerBenefit[] = [
  {
    title: "National & Global Brand Visibility",
    description: "Prominent placement of your company branding on our competition robots, team apparel, event banners, and digital platforms across national Robocon arenas.",
    icon: "Globe",
  },
  {
    title: "Technical Deployment & Case Studies",
    description: "Direct real-world deployment of your software tools, EDA environments, hardware components, and materials in high-stakes robotic competitions.",
    icon: "Cpu",
  },
  {
    title: "Access to Top Engineering Talent",
    description: "Direct connection with motivated student roboticists possessing hands-on expertise in embedded systems, computer vision, kinematics, and control theory.",
    icon: "Users",
  },
  {
    title: "Workshops & Tech Demonstrations",
    description: "Collaborative campus workshops, technology showcases, and guest lectures introducing emerging engineering tools to hundreds of university students.",
    icon: "Wrench",
  },
  {
    title: "Long-Term Innovation Partnership",
    description: "Multi-year collaborative R&D relationships supporting knowledge transfer, hardware testing, and pioneering student-led engineering breakthroughs.",
    icon: "Handshake",
  },
];

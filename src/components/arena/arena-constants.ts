export interface ArenaPartInfo {
    id: string;
    title: string;
    eye: string;
    desc: string;
    specs: [string, string][];
    camera: {
        target: [number, number, number];
        radius: number;
        theta?: number;
        phi?: number;
    };
    ruleRef?: string;
}

export const ARENA_PARTS: Record<string, ArenaPartInfo> = {
    field: {
        id: "field",
        title: "The Game Field",
        eye: "Arena Overview",
        desc: "ABU Robocon 2027 'Mustika Nusantara': an 11 m × 11 m stepped arena where Red and Blue each run a Transporter Robot (TR) and a fully autonomous Builder Robot (BR) for three minutes. Symmetrical about the Center Line. Divided into Ground Area, Level 1 (+600 mm), and Level 2 (+900 mm).",
        specs: [
            ["Dimensions", "11,000 × 11,000 mm (11 × 11 m)"],
            ["Boundary", "100 mm H × 50 mm T"],
            ["Tolerances", "±5% (Rule 13.2)"],
            ["Duration", "3 minutes (180 s)"],
        ],
        camera: { target: [0, 0.6, 0], radius: 18, theta: Math.PI * 0.25, phi: Math.PI * 0.36 },
        ruleRef: "Section 2, Section 14, Fig 3.1",
    },
    ground: {
        id: "ground",
        title: "Ground Area",
        eye: "Floor (0 mm)",
        desc: "The lowest surface - home to the Transporter Robot (TR). Holds the Start Zones, Storage, the Ground Shared Area block bank, and the Mustika Pillar. TR may also enter the Transfer Area, but never the rest of Level 1 or Level 2. BR only touches the ground on a retry or while climbing onto the L1 stairs.",
        specs: [
            ["Footprint", "11 × 11 m overall"],
            ["Elevation", "0 mm (Ground level)"],
            ["Occupant", "Transporter Robot (TR)"],
            ["Surface", "Smooth vinyl / wooden court"],
        ],
        camera: { target: [0, 0.2, 0], radius: 15, theta: Math.PI * 0.25, phi: Math.PI * 0.38 },
        ruleRef: "Section 2, Fig 3.1, Fig 3.2",
    },
    divider: {
        id: "divider",
        title: "Center Divider Fence",
        eye: "Boundary Fence",
        desc: "Splits the Red Team Zone from the Blue Team Zone along the center line of the Ground Area and Level 1. It breaks wherever a shared zone straddles the center line: the Sky Block bank and Mustika pad on the ground, the two L1 Shared Areas on the deck, and the whole of Level 2.",
        specs: [
            ["Height", "50 mm above surface"],
            ["Thickness", "30 mm"],
            ["Material", "Rigid timber divider"],
            ["Openings", "Sky Area (1200 mm), Mustika (1000 mm), L2 (3000 mm)"],
        ],
        camera: { target: [0, 0.3, 0], radius: 13, theta: Math.PI * 0.1, phi: Math.PI * 0.35 },
        ruleRef: "Section 2, Section 14, Fig 3.9, Fig 3.10",
    },
    startzone: {
        id: "startzone",
        title: "Start / Retry Zones",
        eye: "Ground Area",
        desc: "Each team gets two 700 × 700 mm Start Zones on the ground against the perimeter boundary. Robots start within the 700 × 700 × 700 mm cube constraint. Also used as retry zones during the match.",
        specs: [
            ["Dimensions", "700 × 700 mm each"],
            ["Quantity", "4 total (2 Red, 2 Blue)"],
            ["Gap", "100 mm between zones"],
            ["Start envelope", "700 × 700 × 700 mm cube"],
        ],
        camera: { target: [-5.15, 0.3, -4.75], radius: 6, theta: Math.PI * 0.3, phi: Math.PI * 0.38 },
        ruleRef: "Section 2, Fig 3.2(a), Rule 11.4",
    },
    storage: {
        id: "storage",
        title: "Storage Area",
        eye: "Supply Yard",
        desc: "Each team's private 1,000 × 2,000 mm supply yard in the field corner, pre-loaded with 20 Earth Blocks stacked up to two high. The Transporter Robot (TR) harvests foundation blocks from here.",
        specs: [
            ["Dimensions", "1,000 × 2,000 mm"],
            ["Stock", "20 Earth Blocks per team"],
            ["Stacking", "Max 2 layers high (§4.1.3)"],
            ["Access", "Team exclusive (TR)"],
        ],
        camera: { target: [5.0, 0.4, -4.5], radius: 6.5, theta: -Math.PI * 0.25, phi: Math.PI * 0.35 },
        ruleRef: "Section 2, Fig 3.1, Fig 3.2(b)",
    },
    earthblock: {
        id: "earthblock",
        title: "Earth Block",
        eye: "Game Object",
        desc: "350 mm cube of 3-layer corrugated cardboard box in solid team color (Red or Blue). Forms the foundation (Layer 1) and middle (Layer 2) of every Complete Tower. Scores 10/20 pts on L1, doubled to 20/40 pts on L2.",
        specs: [
            ["Dimensions", "350 × 350 × 350 mm (±5%)"],
            ["Weight", "Approx. 600 g (±20%)"],
            ["Quantity", "20 per team"],
            ["Scoring", "L1: 10/20 pts · L2: 20/40 pts"],
        ],
        camera: { target: [4.7, 0.5, -4.5], radius: 3.5, theta: -Math.PI * 0.25, phi: Math.PI * 0.35 },
        ruleRef: "Section 2, Fig 2.1, Appendix p. 10",
    },
    skyarea: {
        id: "skyarea",
        title: "Ground Shared Area (Sky Blocks)",
        eye: "Block Bank",
        desc: "A 1,200 × 1,200 mm shared zone holding 12 Sky Blocks on a 5 × 5 chessboard grid (200 mm pitch, center empty), placed 650 mm from the boundary. Blocks start with their colored faces vertical, so neither red nor blue points up until a robot tips it 90 degrees.",
        specs: [
            ["Dimensions", "1,200 × 1,200 mm"],
            ["Grid", "5 × 5 cells (200 mm pitch)"],
            ["Quantity", "12 Sky Blocks (center empty)"],
            ["Access", "Shared by both teams"],
        ],
        camera: { target: [-4.25, 0.3, 0], radius: 5.5, theta: Math.PI * 0.75, phi: Math.PI * 0.35 },
        ruleRef: "Section 2, Section 14, Fig 3.2(c)",
    },
    skyblock: {
        id: "skyblock",
        title: "Sky Block",
        eye: "Game Object",
        desc: "200 mm cube of 3-layer corrugated cardboard box in team colors (Red blocks and Blue blocks). Placed on the Ground Shared Area in a 5×5 checkerboard grid of 12 blocks (6 Red blocks and 6 Blue blocks). Placed at the top (Layer 3) to complete a tower: 40 pts on L1, 80 pts on L2.",
        specs: [
            ["Dimensions", "200 × 200 × 200 mm (±5%)"],
            ["Weight", "Approx. 220 g (±20%)"],
            ["Quantity", "12 shared total (6 Red, 6 Blue)"],
            ["Scoring", "L1: 40 pts · L2: 80 pts"],
        ],
        camera: { target: [-4.25, 0.4, 0], radius: 3.2, theta: Math.PI * 0.75, phi: Math.PI * 0.35 },
        ruleRef: "Section 2, Fig 2.1, Appendix p. 10",
    },
    mpillar: {
        id: "mpillar",
        title: "Mustika Pillar (Ground)",
        eye: "Ground Pedestal",
        desc: "A 500 mm tall ground pedestal (Ø 270 mm) with a concave cup on top (Ø 180 × 100 mm deep) that cradles the Mustika at the start of the match. Centered 750 mm from the field boundary. TR may only lift the Mustika once the Sanctuary Mandate is achieved.",
        specs: [
            ["Height", "500 mm from ground"],
            ["Diameter", "Ø 270 mm"],
            ["Cup Receptacle", "Ø 180 mm × 100 mm depth"],
            ["Location", "On center line (Ground Shared Area)"],
        ],
        camera: { target: [4.25, 0.5, 0], radius: 5.5, theta: -Math.PI * 0.25, phi: Math.PI * 0.35 },
        ruleRef: "Section 2, Fig 3.2(d), Fig 3.5",
    },
    mustika: {
        id: "mustika",
        title: "The Mustika",
        eye: "Target Sacred Sphere",
        desc: "The sacred artifact of the competition: Ø ≈ 210 mm sphere (Mikasa V300W volleyball specifications, circumference 65-67 cm, mass ~270 g, yellow and blue panels). Starts seated on the Mustika Pillar; carried up to the Central Pillar on Level 2 to claim the 250-point grand prize.",
        specs: [
            ["Diameter", "Ø ≈ 210 mm (circ. 65-67 cm)"],
            ["Mass", "Approx. 270 g"],
            ["Start Position", "Mustika Pillar cup (Ground)"],
            ["Goal Position", "Central Pillar cup (Level 2)"],
            ["Reward", "+250 pts on enshrinement"],
        ],
        camera: { target: [4.25, 0.65, 0], radius: 2.8, theta: -Math.PI * 0.25, phi: Math.PI * 0.35 },
        ruleRef: "Section 2, Section 14, Fig 2.1, Fig 3.5",
    },
    access: {
        id: "access",
        title: "Stairs & Ramp Access Strip",
        eye: "Ground-to-L1 Transition",
        desc: "Each side features a 3,500 mm ramp and a 4-riser staircase (300 × 1,000 × 150 mm steps) climbing the 600 mm to Level 1. Both run parallel to the L1 edge and meet at the Transfer Area landing. BR climbs to L1 here; TR drives up the ramp to deliver blocks.",
        specs: [
            ["Stairs", "4 steps: 300 L × 1,000 W × 150 H mm"],
            ["Ramp", "3,500 mm run along edge, 600 mm rise"],
            ["Width", "1,000 mm (1 m access strip)"],
            ["Elevation", "Rises from 0 mm to 600 mm"],
        ],
        camera: { target: [0, 0.5, -3.5], radius: 8.5, theta: 0, phi: Math.PI * 0.36 },
        ruleRef: "Section 2, Fig 3.3, Fig 3.7, Fig 3.8",
    },
    transfer: {
        id: "transfer",
        title: "Transfer Area",
        eye: "Handover Landing",
        desc: "A 1,000 × 1,000 mm landing on the L1 perimeter at the top of the ramp (elevation +600 mm). TR hands blocks or the Mustika straight to BR, or sets them down inside for BR to retrieve. Each Earth or Sky Block released inside scores 5 points; the Mustika scores 0 points here.",
        specs: [
            ["Dimensions", "1,000 × 1,000 mm"],
            ["Elevation", "+600 mm (flush with Level 1)"],
            ["Points", "Earth / Sky Block: +5 pts"],
            ["Constraint", "TR placing must be off the ground (v1.1)"],
        ],
        camera: { target: [-1.3, 0.7, -3.5], radius: 4.8, theta: Math.PI * 0.15, phi: Math.PI * 0.36 },
        ruleRef: "Section 2, Fig 3.3, Fig 3.7",
    },
    buildspot: {
        id: "buildspot",
        title: "Building Spots",
        eye: "Tower Bases",
        desc: "Green 500 × 500 mm targets where BR stacks Complete Towers. Six spots on Level 1 (4 team-exclusive in corners + 2 shared on center line) and four spots on Level 2 (all shared).",
        specs: [
            ["Dimensions", "500 × 500 mm"],
            ["Quantity", "10 total (6 on L1, 4 on L2)"],
            ["L1 Spots", "4 Exclusive, 2 Shared"],
            ["L2 Spots", "4 Shared (summit corners)"],
        ],
        camera: { target: [-2.75, 0.75, -2.75], radius: 4.5, theta: Math.PI * 0.25, phi: Math.PI * 0.35 },
        ruleRef: "Section 2, Fig 3.3, Fig 3.4",
    },
    tower: {
        id: "tower",
        title: "The Complete Tower",
        eye: "Scoring Structure",
        desc: "Two Earth Blocks, then one Sky Block - in that exact order (Layer 1: Earth, Layer 2: Earth, Layer 3: Sky). The Sky Block must be tipped so your team color faces UP. Building two towers (one in an L1 or L2 Shared Area) satisfies the Sanctuary Mandate, unlocking the Mustika.",
        specs: [
            ["Layer 1 (Bottom)", "Earth Block (10 pts L1 / 20 pts L2)"],
            ["Layer 2 (Middle)", "Earth Block (10 pts L1 / 20 pts L2)"],
            ["Layer 3 (Top)", "Sky Block (40 pts L1 / 80 pts L2)"],
            ["Mandate", "2 Complete Towers unlocks Mustika"],
        ],
        camera: { target: [-2.75, 1.1, -2.75], radius: 4.2, theta: Math.PI * 0.25, phi: Math.PI * 0.35 },
        ruleRef: "Section 2, Section 4, Rule 4.1",
    },
    level1: {
        id: "level1",
        title: "Level 1 (L1 Platform)",
        eye: "Tier 1 Platform",
        desc: "First elevated platform, 600 mm above ground, 6 × 6 m footprint. Home to the Builder Robot (BR). Surrounded by a 50 mm high perimeter barrier with openings at the Transfer Areas and L1 Shared Areas.",
        specs: [
            ["Dimensions", "6,000 × 6,000 mm (Floor 5,940 × 5,940 mm)"],
            ["Elevation", "+600 mm from ground"],
            ["Perimeter Barrier", "50 mm H × 30 mm T"],
            ["Occupant", "Builder Robot (BR)"],
        ],
        camera: { target: [0, 0.9, 0], radius: 12, theta: Math.PI * 0.25, phi: Math.PI * 0.36 },
        ruleRef: "Section 2, Fig 3.3, Fig 3.6",
    },
    level2: {
        id: "level2",
        title: "Level 2 (The Summit)",
        eye: "Top Platform",
        desc: "The highest platform, 900 mm above ground (300 mm above Level 1), 3 × 3 m footprint. Fully shared by both teams. Contains four corner Building Spots and the Central Pillar at its center.",
        specs: [
            ["Dimensions", "3,000 × 3,000 mm (3 × 3 m)"],
            ["Elevation", "+900 mm from ground (+300 mm above L1)"],
            ["Access", "Fully shared by both teams"],
            ["Spots", "4 Shared Building Spots (500 × 500 mm)"],
        ],
        camera: { target: [0, 1.15, 0], radius: 7.5, theta: Math.PI * 0.25, phi: Math.PI * 0.36 },
        ruleRef: "Section 2, Fig 3.4, Fig 3.6",
    },
    cpillar: {
        id: "cpillar",
        title: "Central Pillar & Enshrinement",
        eye: "Apex Goal",
        desc: "The tallest structure in the arena (800 mm tall above L2, Ø 270 mm, total apex height 1,700 mm). The receptacle bowl starts empty at match start. Seating the Mustika in its top receptacle earns 250 points - the single largest prize in the game. The match continues until the full 3 minutes expire.",
        specs: [
            ["Height", "800 mm above L2 (1,700 mm total)"],
            ["Diameter", "Ø 270 mm"],
            ["Cup Receptacle", "Ø 180 mm × 100 mm depth"],
            ["Grand Reward", "+250 points on enshrinement"],
        ],
        camera: { target: [0, 1.35, 0], radius: 4.8, theta: 0, phi: Math.PI * 0.36 },
        ruleRef: "Section 2, Fig 3.4, Fig 3.5",
    },
};

export const TOUR_STEPS = [
    { key: "field", title: "The Game Field" },
    { key: "ground", title: "The Ground Area" },
    { key: "startzone", title: "Start / Retry Zones" },
    { key: "storage", title: "Storage & Earth Blocks" },
    { key: "earthblock", title: "The Earth Block" },
    { key: "skyarea", title: "The Shared Block Bank" },
    { key: "skyblock", title: "The Sky Block" },
    { key: "mpillar", title: "The Mustika Pillar" },
    { key: "mustika", title: "The Mustika" },
    { key: "access", title: "Climbing to Level 1" },
    { key: "transfer", title: "The Transfer Area" },
    { key: "buildspot", title: "Building Spots" },
    { key: "tower", title: "The Complete Tower" },
    { key: "level1", title: "Level 1 Platform" },
    { key: "level2", title: "The Summit (Level 2)" },
    { key: "cpillar", title: "Enshrine the Mustika" },
];

export const OFFICIAL_DOC_DETAILS = {
    title: "ABU Asia-Pacific Robot Contest 2027 Solo, Indonesia",
    theme: "The Pursuit of Mustika Nusantara",
    document: "APPENDIX — Game Object Specifications and Game Field Drawings",
    version: "October 2026 (V1.1)",
    website: "http://www.aburobocon2027.id",
    earthBlockTaobao: "https://item.taobao.com/item.htm?id=983355886264",
    skyBlockTaobao: "https://item.taobao.com/item.htm?id=1077841648410",
};

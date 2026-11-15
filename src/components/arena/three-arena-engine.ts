"use client";

import { ARENA_PARTS, type ArenaPartInfo } from "./arena-constants";

declare global {
    interface Window {
        THREE: any;
    }
}

export interface EngineInstance {
    destroy: () => void;
    resize: (width: number, height: number) => void;
    focusTo: (target: [number, number, number], radius: number, theta?: number, phi?: number) => void;
    selectPart: (partId: string, lift?: boolean) => void;
    clearSelection: () => void;
    setWireframe: (wireframe: boolean) => void;
    setIsolate: (isolate: boolean) => void;
    setRobotsVisible: (visible: boolean) => void;
    setAutoRotate: (autoRotate: boolean) => void;
    setPresetView: (view: "iso" | "top" | "side" | "red" | "blue" | "summit") => void;
    demoAssembleTower: () => void;
    resetDemoTower: () => void;
    takeScreenshot: () => string | null;
}

export function createArenaEngine(
    container: HTMLElement,
    canvas: HTMLCanvasElement,
    onSelectPart: (part: ArenaPartInfo) => void
): EngineInstance | null {
    const THREE = window.THREE;
    if (!THREE) {
        console.error("Three.js not loaded on window.THREE");
        return null;
    }

    // High-contrast, dark-theme palette matching Robocon Hub & Reference Field Lab
    const C = {
        bg: 0x090a0f,
        groundR: 0x1f1418, // Deep dark slate with subtle crimson undertone
        groundB: 0x101726, // Deep dark slate with subtle navy undertone
        sharedPad: 0xf5f0c8, // Reference website cream/beige pad underlay
        sharedSpot: 0x23201a, // Reference website dark center for shared spot
        startR: 0xd92626,
        startB: 0x2563eb,
        pillar: 0x92400e,
        boundary: 0x2e231c,
        stairsR: 0x3d281a,
        stairsB: 0x16243b,
        rampR: 0x2d1f18,
        rampB: 0x131f33,
        l1Core: 0x161820,
        l1R: 0x26171b,
        l1B: 0x131c2d,
        spotR: 0x15803d,
        spotB: 0x15803d,
        l2: 0x232836,
        barrier: 0x333b4d,
        transferR: 0x5a3d16,
        transferB: 0x153e5e,
        earthR: 0xd93838,
        earthB: 0x2563eb,
        skyR: 0xef4444,
        skyB: 0x3b82f6,
        cardboard: 0xd8cca8, // Neutral kraft cardboard for top/bottom & sides
        mustika: 0xfacc15,
    };

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 550;

    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    if (renderer.outputEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
    if (renderer.toneMapping !== undefined) {
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
    }
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(C.bg);
    scene.fog = new THREE.Fog(C.bg, 22, 55);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);

    // Dynamic Lighting
    const hemiLight = new THREE.HemisphereLight(0xfff5e6, 0x10131a, 0.65);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffaee, 1.15);
    dirLight.position.set(9, 15, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    const d = 11;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 45;
    dirLight.shadow.bias = -0.0003;
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x4a78c8, 0.45);
    rimLight.position.set(-10, 8, -8);
    scene.add(rimLight);

    const ambLight = new THREE.AmbientLight(0x181c26, 0.55);
    scene.add(ambLight);

    // Material & Mesh Helpers
    function mat(col: number, opt: any = {}) {
        return new THREE.MeshStandardMaterial({
            color: col,
            roughness: opt.roughness !== undefined ? opt.roughness : 0.65,
            metalness: opt.metalness !== undefined ? opt.metalness : 0.15,
            side: opt.side || THREE.FrontSide,
        });
    }

    function box(
        w: number,
        h: number,
        dp: number,
        color: number,
        x: number,
        y: number,
        z: number,
        opt: any = {}
    ) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dp), mat(color, opt));
        m.position.set(x, y, z);
        m.castShadow = true;
        m.receiveShadow = true;
        scene.add(m);
        return m;
    }

    // Interactive parts registry
    const partsMap = new Map<string, any>();
    const meshToPartId = new Map<any, string>();

    function registerPart(id: string, mesh: any, info: ArenaPartInfo) {
        partsMap.set(id, { mesh, info });
        if (mesh) {
            mesh.traverse((child: any) => {
                if (child.isMesh) {
                    meshToPartId.set(child, id);
                }
            });
        }
    }

    // =========================================================================
    // 1. BOUNDARY FRAME (11m x 11m, 100mm H, 50mm T)
    // =========================================================================
    const t = 0.05;
    const H = 0.1;
    const S = 11.0;
    const bCol = C.boundary;
    box(S + 2 * t, H, t, bCol, 0, H / 2, -(S / 2 + t / 2)); // South border (Red side)
    box(S + 2 * t, H, t, bCol, 0, H / 2, S / 2 + t / 2);  // North border (Blue side)
    box(t, H, S, bCol, -(S / 2 + t / 2), H / 2, 0);       // West border (Sky/Start side)
    box(t, H, S, bCol, S / 2 + t / 2, H / 2, 0);        // East border (Mustika/Storage side)

    // =========================================================================
    // 2. GROUND HALVES (Z < 0: Red Half, Z > 0: Blue Half)
    // =========================================================================
    const groundBaseH = 0.04;
    // Red ground: X from -5.5 to +5.5, Z from -5.5 to 0 (center z = -2.75)
    const gRed = box(11.0, groundBaseH, 5.5, C.groundR, 0, -groundBaseH / 2, -2.75);
    // Blue ground: X from -5.5 to +5.5, Z from 0 to +5.5 (center z = +2.75)
    const gBlue = box(11.0, groundBaseH, 5.5, C.groundB, 0, -groundBaseH / 2, 2.75);
    registerPart("ground", gRed, ARENA_PARTS.ground);
    registerPart("field", gBlue, ARENA_PARTS.field);

    // Center divider strip along Z = 0 (breaks at Sky Area, Level 1, and Mustika Pillar)
    const addDividerSeg = (x1: number, x2: number) => {
        const len = x2 - x1;
        const dMesh = box(len, 0.05, 0.03, C.boundary, (x1 + x2) / 2, 0.025, 0);
        registerPart("divider", dMesh, ARENA_PARTS.divider);
        return dMesh;
    };
    // Segment 1: from -5.5 to Sky Blocks opening (-4.85)
    addDividerSeg(-5.5, -4.85);
    // Segment 2: from Sky Blocks opening (-3.65) to Level 1 edge (-3.0)
    addDividerSeg(-3.65, -3.0);
    // Segment 3: from Level 1 edge (+3.0) to Mustika opening (+3.75)
    addDividerSeg(3.0, 3.75);
    // Segment 4: from Mustika opening (+4.75) to perimeter (+5.5)
    addDividerSeg(4.75, 5.5);

    // =========================================================================
    // 3. START / RETRY ZONES (700 x 700 mm each, 100 mm gap between zones)
    // Located at West perimeter (x = -5.15)
    // =========================================================================
    const startGeom = new THREE.BoxGeometry(0.70, 0.02, 0.70);

    // Red Start Zones (in -Z half)
    const rStart1 = new THREE.Mesh(startGeom, mat(C.startR, { roughness: 0.5 }));
    rStart1.position.set(-5.15, 0.01, -5.15); // Zone 1: TR
    rStart1.receiveShadow = true;
    scene.add(rStart1);

    const rStart2 = new THREE.Mesh(startGeom, mat(C.startR, { roughness: 0.5 }));
    rStart2.position.set(-5.15, 0.01, -4.35); // Zone 2: BR
    rStart2.receiveShadow = true;
    scene.add(rStart2);

    // Blue Start Zones (in +Z half)
    const bStart1 = new THREE.Mesh(startGeom, mat(C.startB, { roughness: 0.5 }));
    bStart1.position.set(-5.15, 0.01, 5.15);  // Zone 1: TR
    bStart1.receiveShadow = true;
    scene.add(bStart1);

    const bStart2 = new THREE.Mesh(startGeom, mat(C.startB, { roughness: 0.5 }));
    bStart2.position.set(-5.15, 0.01, 4.35);  // Zone 2: BR
    bStart2.receiveShadow = true;
    scene.add(bStart2);

    registerPart("startzone", rStart1, ARENA_PARTS.startzone);

    // =========================================================================
    // 4. STORAGE AREAS & 20 EARTH BLOCKS EACH (1000 x 2000 mm pad at x = +5.0)
    // =========================================================================
    const storageGeom = new THREE.BoxGeometry(1.0, 0.02, 2.0);

    // Red Storage Area (at x = 5.0, z = -4.5)
    const rStore = new THREE.Mesh(storageGeom, mat(0x7f1d1d, { roughness: 0.7 }));
    rStore.position.set(5.0, 0.01, -4.5);
    rStore.receiveShadow = true;
    scene.add(rStore);

    // Blue Storage Area (at x = 5.0, z = +4.5)
    const bStore = new THREE.Mesh(storageGeom, mat(0x1e3a8a, { roughness: 0.7 }));
    bStore.position.set(5.0, 0.01, 4.5);
    bStore.receiveShadow = true;
    scene.add(bStore);

    registerPart("storage", rStore, ARENA_PARTS.storage);

    // 20 Earth Blocks per team (350mm cubes: 2 cols in X x 5 rows in Z x 2 layers in Y)
    const earthGroup = new THREE.Group();
    scene.add(earthGroup);
    const eGeom = new THREE.BoxGeometry(0.35, 0.35, 0.35);
    const eMatR = mat(C.earthR, { roughness: 0.55 });
    const eMatB = mat(C.earthB, { roughness: 0.55 });

    let firstEarth: any = null;
    for (let c = 0; c < 2; c++) {
        const cx = 4.78 + c * 0.44; // Centered in 1.0m width in X
        for (let r = 0; r < 5; r++) {
            for (let l = 0; l < 2; l++) {
                const ly = 0.175 + l * 0.352;

                // Red blocks in Red Storage (z from -5.26 to -3.74)
                const rz = -5.26 + r * 0.38;
                const ebR = new THREE.Mesh(eGeom, eMatR);
                ebR.position.set(cx, ly, rz);
                ebR.castShadow = true;
                ebR.receiveShadow = true;
                earthGroup.add(ebR);
                if (!firstEarth) firstEarth = ebR;

                // Blue blocks in Blue Storage (z from +3.74 to +5.26)
                const bz = 3.74 + r * 0.38;
                const ebB = new THREE.Mesh(eGeom, eMatB);
                ebB.position.set(cx, ly, bz);
                ebB.castShadow = true;
                ebB.receiveShadow = true;
                earthGroup.add(ebB);
            }
        }
    }
    registerPart("earthblock", firstEarth, ARENA_PARTS.earthblock);

    // =========================================================================
    // 5. GROUND SHARED AREA & 12 SKY BLOCKS (Center line z = 0, x = -4.25)
    // 5x5 grid of 200mm cells, checkerboard pattern of 12 blocks
    // Distinct solid team blocks: 6 Red blocks and 6 Blue blocks
    // =========================================================================
    const skyPad = box(1.2, 0.02, 1.2, C.sharedPad, -4.25, 0.01, 0);
    registerPart("skyarea", skyPad, ARENA_PARTS.skyarea);

    const skyGroup = new THREE.Group();
    scene.add(skyGroup);
    const skyGeom = new THREE.BoxGeometry(0.2, 0.2, 0.2);

    const sMatR = mat(C.skyR, { roughness: 0.55 });
    const sMatB = mat(C.skyB, { roughness: 0.55 });

    const skyPattern = [
        [0, 1, 0, 1, 0],
        [1, 0, 1, 0, 1],
        [0, 1, 0, 1, 0],
        [1, 0, 1, 0, 1],
        [0, 1, 0, 1, 0],
    ];

    let firstSky: any = null;
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
            if (skyPattern[r][c] === 1) {
                const px = -4.25 + (r - 2) * 0.2;
                const pz = (c - 2) * 0.2;

                // Distinct Red and Blue blocks (6 Red blocks, 6 Blue blocks)
                // c < 2 (Red half z < 0) => Red block
                // c > 2 (Blue half z > 0) => Blue block
                // c == 2 (center line z = 0): alternating by row (r=1 Red, r=3 Blue)
                const isRed = c < 2 || (c === 2 && r === 1);
                const sMat = isRed ? sMatR : sMatB;

                const sMesh = new THREE.Mesh(skyGeom, sMat);
                sMesh.position.set(px, 0.1, pz);
                sMesh.castShadow = true;
                sMesh.receiveShadow = true;
                skyGroup.add(sMesh);
                if (!firstSky) firstSky = sMesh;
            }
        }
    }
    registerPart("skyblock", firstSky, ARENA_PARTS.skyblock);

    // =========================================================================
    // 6. GROUND MUSTIKA PILLAR (Center line z = 0, x = +4.25)
    // Height 500mm, Diameter 270mm. ONE Mustika ball seated at match start.
    // =========================================================================
    const pMat = mat(C.pillar, { roughness: 0.6, metalness: 0.25 });
    const mPillarGroup = new THREE.Group();
    const pGeom = new THREE.CylinderGeometry(0.135, 0.14, 0.46, 32);
    const pMesh = new THREE.Mesh(pGeom, pMat);
    pMesh.position.set(4.25, 0.23, 0);
    pMesh.castShadow = true;
    mPillarGroup.add(pMesh);

    // Receptacle bowl
    const bowlGeom = new THREE.CylinderGeometry(0.09, 0.05, 0.08, 24);
    const bowlMesh = new THREE.Mesh(bowlGeom, mat(0x1a1208, { roughness: 0.9 }));
    bowlMesh.position.set(4.25, 0.46, 0);
    mPillarGroup.add(bowlMesh);
    scene.add(mPillarGroup);
    registerPart("mpillar", pMesh, ARENA_PARTS.mpillar);

    // The ONE Mustika Ball seated in the Ground Pillar bowl
    const mSphereGeom = new THREE.SphereGeometry(0.105, 32, 24);
    const mSphereMat = new THREE.MeshStandardMaterial({
        color: C.mustika,
        roughness: 0.35,
        metalness: 0.2,
        emissive: 0x92400e,
        emissiveIntensity: 0.25,
    });
    const mSphereGround = new THREE.Mesh(mSphereGeom, mSphereMat);
    mSphereGround.position.set(4.25, 0.54, 0);
    mSphereGround.castShadow = true;
    scene.add(mSphereGround);
    registerPart("mustika", mSphereGround, ARENA_PARTS.mustika);

    // =========================================================================
    // 7. LEVEL 1 PLATFORM (6m x 6m, Height 600mm)
    // Elevation: y = 0.60. Core: x from -3.0 to +3.0, z from -3.0 to +3.0
    // =========================================================================
    const l1Core = box(6.0, 0.6, 6.0, C.l1Core, 0, 0.3, 0);
    const l1Red = box(5.96, 0.02, 2.97, C.l1R, 0, 0.61, -1.485);
    const l1Blue = box(5.96, 0.02, 2.97, C.l1B, 0, 0.61, 1.485);
    registerPart("level1", l1Core, ARENA_PARTS.level1);

    // Perimeter barriers on L1 (50mm H, 30mm T)
    const barH = 0.05;
    const barT = 0.03;
    const barY = 0.6 + barH / 2;
    // East & West walls (along X = +/-2.985)
    box(barT, barH, 6.0, C.barrier, -2.985, barY, 0);
    box(barT, barH, 6.0, C.barrier, 2.985, barY, 0);
    // North & South walls (leaving 1.0m openings at Transfer Areas: x = -1.8 to -0.8)
    // Red side wall at z = -2.985
    box(1.2, barH, barT, C.barrier, -2.4, barY, -2.985); // x from -3.0 to -1.8
    box(3.8, barH, barT, C.barrier, 1.1, barY, -2.985);  // x from -0.8 to +3.0
    // Blue side wall at z = +2.985
    box(1.2, barH, barT, C.barrier, -2.4, barY, 2.985);  // x from -3.0 to -1.8
    box(3.8, barH, barT, C.barrier, 1.1, barY, 2.985);   // x from -0.8 to +3.0

    // Two Shared Areas on Level 1 (0.75m in X x 1.0m in Z) with Cream / Beige Underlay
    const sharedPad1 = box(0.75, 0.022, 1.0, C.sharedPad, -2.75, 0.611, 0);
    const sharedPad2 = box(0.75, 0.022, 1.0, C.sharedPad, 2.75, 0.611, 0);

    // =========================================================================
    // 8. ACCESS STRIPS: STAIRS, TRANSFER AREA & RAMP
    // Parallel to L1 at z = -3.5 (Red side) and z = +3.5 (Blue side). Width = 1.0m.
    // - Stairs: x = -3.00 to -1.80 (4 steps of 300mm tread, risers 150mm, 300mm, 450mm, 600mm)
    //   -> Climbs continuously up to y = 0.60m (the exact level of the Transfer Area)
    // - Transfer Area: x = -1.80 to -0.80 (1.0m x 1.0m landing at y = 0.60m)
    //   -> Starts immediately after Step 4 ends at x = -1.80m, y = 0.60m (flush, zero gap)
    // - Ramp: x = -0.80 to +2.70 (3.5m run along X, 0.60m rise)
    //   -> Starts at Transfer Area landing (x = -0.80, y = 0.60m) and slopes down to ground at x = +2.70
    //   -> Constructed as a solid architectural triangular prism
    // =========================================================================
    [-3.5, 3.5].forEach((zPos, isBlue) => {
        const teamStairCol = isBlue ? C.stairsB : C.stairsR;
        const teamTransCol = isBlue ? C.transferB : C.transferR;
        const teamRampCol = isBlue ? C.rampB : C.rampR;

        // 1. STAIRS: 4 steps of 300mm length along X, reaching y = 0.60m
        const stepWidthX = 0.30;
        for (let i = 0; i < 4; i++) {
            const sh = 0.15 * (i + 1); // 0.15m, 0.30m, 0.45m, 0.60m
            const sx = -3.00 + stepWidthX * i + stepWidthX / 2; // -2.85, -2.55, -2.25, -1.95
            const sMesh = new THREE.Mesh(
                new THREE.BoxGeometry(stepWidthX, sh, 1.0),
                mat(teamStairCol, { roughness: 0.85 })
            );
            sMesh.position.set(sx, sh / 2, zPos);
            sMesh.castShadow = true;
            sMesh.receiveShadow = true;
            scene.add(sMesh);
        }

        // 2. TRANSFER AREA: Starts after Step 4 ends at x = -1.80m, extends to x = -0.80m
        // Center x = -1.30, height = 0.60m (elevation y = 0.60m flush with Step 4)
        const tMesh = box(1.0, 0.60, 1.0, teamTransCol, -1.30, 0.30, zPos);
        if (!isBlue) registerPart("transfer", tMesh, ARENA_PARTS.transfer);

        // 3. RAMP: Solid architectural prism from x = -0.80m down to x = +2.70m
        // High end at x = -0.80m, y = 0.60m; low end lands at x = +2.70m, y = 0
        const rampShape = new THREE.Shape();
        rampShape.moveTo(-0.80, 0);
        rampShape.lineTo(-0.80, 0.60);
        rampShape.lineTo(2.70, 0);
        rampShape.closePath();

        const extrudeSettings = {
            depth: 1.0,
            bevelEnabled: false,
        };
        const rampSolidGeom = new THREE.ExtrudeGeometry(rampShape, extrudeSettings);
        rampSolidGeom.computeVertexNormals();

        const rampMesh = new THREE.Mesh(rampSolidGeom, mat(teamRampCol, { roughness: 0.85 }));
        // ExtrudeGeometry extrudes along +Z from 0 to depth (1.0m)
        // Setting z to zPos - 0.5 centers it exactly at zPos
        rampMesh.position.set(0, 0, zPos - 0.5);
        rampMesh.castShadow = true;
        rampMesh.receiveShadow = true;
        scene.add(rampMesh);

        // Sloped surface tread / curb guide rail along the outer edge (z = +/-4.0)
        const outerZ = isBlue ? zPos + 0.485 : zPos - 0.485;
        const railShape = new THREE.Shape();
        railShape.moveTo(-0.80, 0.60);
        railShape.lineTo(-0.80, 0.65);
        railShape.lineTo(2.70, 0.05);
        railShape.lineTo(2.70, 0);
        railShape.closePath();
        const railGeom = new THREE.ExtrudeGeometry(railShape, { depth: 0.03, bevelEnabled: false });
        railGeom.computeVertexNormals();
        const railMesh = new THREE.Mesh(railGeom, mat(C.barrier, { roughness: 0.7 }));
        railMesh.position.set(0, 0, isBlue ? outerZ : outerZ - 0.03);
        railMesh.castShadow = true;
        scene.add(railMesh);

        if (!isBlue) registerPart("access", rampMesh, ARENA_PARTS.access);
    });

    // =========================================================================
    // 9. LEVEL 2 PLATFORM (3m x 3m, Height 900mm)
    // Centered at (0, 0, 0), from x = -1.5 to +1.5, z = -1.5 to +1.5
    // =========================================================================
    const l2Core = box(3.0, 0.3, 3.0, C.barrier, 0, 0.75, 0);
    const l2Top = box(3.0, 0.02, 3.0, C.l2, 0, 0.91, 0);
    registerPart("level2", l2Core, ARENA_PARTS.level2);

    // =========================================================================
    // 10. 10 BUILDING SPOTS (500x500mm markers)
    // 6 on Level 1 (4 exclusive, 2 center-line shared)
    // 4 on Level 2 (corners of L2)
    // THE 2 SHARED SPOTS: Distinctive cream/beige border & dark center
    // =========================================================================
    const spotGeom = new THREE.BoxGeometry(0.5, 0.024, 0.5);
    const spotMat = mat(0x15803d, { roughness: 0.5 }); // Emerald team spot
    let firstSpot: any = null;

    // Exclusive L1 Spots (4 spots)
    const exclusiveSpotsL1 = [
        [-2.0, 0.612, -2.25], // Red L1 Spot 1
        [2.0, 0.612, -2.25],  // Red L1 Spot 2
        [-2.0, 0.612, 2.25],  // Blue L1 Spot 1
        [2.0, 0.612, 2.25],   // Blue L1 Spot 2
    ];
    exclusiveSpotsL1.forEach(([x, y, z]) => {
        const sm = new THREE.Mesh(spotGeom, spotMat);
        sm.position.set(x, y, z);
        sm.receiveShadow = true;
        scene.add(sm);
        if (!firstSpot) firstSpot = sm;
    });

    // The 2 Shared Building Spots on Level 1 (Center line z = 0 at x = -2.75 and x = +2.75)
    // As seen in the reference website: styled with beige/cream border and dark center
    const sharedSpotGeom = new THREE.BoxGeometry(0.50, 0.024, 0.50);
    const sharedInnerGeom = new THREE.BoxGeometry(0.38, 0.025, 0.38);
    const sharedBorderMat = mat(0xe5dcba, { roughness: 0.6 }); // Cream/beige outer
    const sharedInnerMat = mat(0x28231c, { roughness: 0.8 });  // Dark center

    [-2.75, 2.75].forEach((x) => {
        const borderMesh = new THREE.Mesh(sharedSpotGeom, sharedBorderMat);
        borderMesh.position.set(x, 0.612, 0);
        borderMesh.receiveShadow = true;
        scene.add(borderMesh);

        const innerMesh = new THREE.Mesh(sharedInnerGeom, sharedInnerMat);
        innerMesh.position.set(x, 0.613, 0);
        innerMesh.receiveShadow = true;
        scene.add(innerMesh);
    });

    // 4 Exclusive Spots on Level 2 (elevation y = 0.912)
    const spotsL2 = [
        [-0.90, 0.912, -0.90],
        [0.90, 0.912, -0.90],
        [-0.90, 0.912, 0.90],
        [0.90, 0.912, 0.90],
    ];
    spotsL2.forEach(([x, y, z]) => {
        const sm = new THREE.Mesh(spotGeom, spotMat);
        sm.position.set(x, y, z);
        sm.receiveShadow = true;
        scene.add(sm);
    });
    registerPart("buildspot", firstSpot, ARENA_PARTS.buildspot);

    // =========================================================================
    // 11. CENTRAL PILLAR (Height 800mm above L2, total elevation 1700mm)
    // RECEPTACLE IS COMPLETELY EMPTY AT START (Upper ball removed per request)
    // =========================================================================
    const cPillarGroup = new THREE.Group();
    const cpGeom = new THREE.CylinderGeometry(0.135, 0.14, 0.76, 32);
    const cpMesh = new THREE.Mesh(cpGeom, pMat);
    cpMesh.position.set(0, 0.90 + 0.38, 0);
    cpMesh.castShadow = true;
    cPillarGroup.add(cpMesh);

    // Receptacle bowl atop Central Pillar (Empty at start)
    const cBowlMesh = new THREE.Mesh(bowlGeom, mat(0x1a1208, { roughness: 0.9 }));
    cBowlMesh.position.set(0, 1.66, 0);
    cPillarGroup.add(cBowlMesh);
    scene.add(cPillarGroup);
    registerPart("cpillar", cpMesh, ARENA_PARTS.cpillar);

    // =========================================================================
    // 12. EXACT ROBOTS & PARKING (Placed accurately in Start Zones)
    // Red TR: (-5.15, 0, -5.15), Red BR: (-5.15, 0, -4.35) -> Facing +X
    // Blue TR: (-5.15, 0, +5.15), Blue BR: (-5.15, 0, +4.35) -> Facing +X
    // =========================================================================
    const RS = {
        chassis: { l: 0.56, w: 0.50, h: 0.13, clear: 0.045 },
        wheel: { r: 0.075, w: 0.05 },
        deckY: 0.175,
        mastZ: 0.20,
        stage1H: 0.66,
        stage2Max: 0.48,
        liftFoot: 0.08,
        anchorZ0: 0.30,
        magazineZ: -0.09,
    };

    const RG = {
        chassis: new THREE.BoxGeometry(RS.chassis.w, RS.chassis.h, RS.chassis.l),
        band: new THREE.BoxGeometry(RS.chassis.w + 0.012, 0.035, RS.chassis.l + 0.012),
        deck: new THREE.BoxGeometry(RS.chassis.w - 0.04, 0.012, RS.chassis.l - 0.04),
        wheel: new THREE.CylinderGeometry(RS.wheel.r, RS.wheel.r, RS.wheel.w, 16).rotateZ(Math.PI / 2),
        roller: new THREE.BoxGeometry(RS.wheel.w + 0.004, 0.012, 0.03),
        bumper: new THREE.BoxGeometry(RS.chassis.w, 0.05, 0.03),
        mast1: new THREE.BoxGeometry(0.075, RS.stage1H - 0.04, 0.075),
        mast2: new THREE.BoxGeometry(0.05, RS.stage2Max + 0.04, 0.05),
        mastCap: new THREE.BoxGeometry(0.10, 0.025, 0.10),
        plate: new THREE.BoxGeometry(0.20, 0.12, 0.035),
        sleeve: new THREE.BoxGeometry(0.09, 0.07, 0.08),
        slide: new THREE.BoxGeometry(0.06, 0.045, 1),
        rail: new THREE.BoxGeometry(0.50, 0.035, 0.04),
        jaw: new THREE.BoxGeometry(0.028, 0.20, 0.20),
        post: new THREE.BoxGeometry(0.022, 1, 0.022),
        puck: new THREE.CylinderGeometry(0.045, 0.045, 0.045, 16),
        beacon: new THREE.SphereGeometry(0.035, 12, 8),
        flag: new THREE.BoxGeometry(0.015, 0.10, 0.12),
    };

    const RM = {
        chassis: mat(0x1a1a1e, { metalness: 0.50, roughness: 0.45 }),
        dark: mat(0x262830, { metalness: 0.55 }),
        wheel: mat(0x0e0f12, { roughness: 0.85, metalness: 0.15 }),
        roller: mat(0x4a4d56, { roughness: 0.6, metalness: 0.35 }),
        mast2: mat(0xa0a5b2, { metalness: 0.75, roughness: 0.30 }),
        slide: mat(0x787e8e, { metalness: 0.65 }),
        jaw: mat(0x9298a8, { metalness: 0.60 }),
        post: mat(0x5a5e6b, { metalness: 0.55 }),
        puck: mat(0x111317, { roughness: 0.3, metalness: 0.3 }),
    };

    function pin(o: any, x: number, y: number, z: number) {
        o.position.set(x, y, z);
        o.matrixAutoUpdate = false;
        o.updateMatrix();
        return o;
    }

    function makeExactRobot(teamColor: number, isBuilder: boolean) {
        const g = new THREE.Group();
        const cyC = RS.chassis.clear + RS.chassis.h / 2;

        const teamMat = {
            band: mat(teamColor, { metalness: 0.40, roughness: 0.40 }),
            cap: mat(teamColor, { metalness: 0.45 }),
        };

        const roleMat = {
            plate: mat(isBuilder ? 0xd4af37 : 0x7c8496, { metalness: 0.50 }),
            flag: mat(isBuilder ? 0xd4af37 : 0x7c8496, { metalness: 0.45 }),
            beacon: new THREE.MeshStandardMaterial({
                color: isBuilder ? 0xffd66b : 0x60a5fa,
                emissive: isBuilder ? 0xb45309 : 0x1d4ed8,
                emissiveIntensity: 0.85,
            }),
        };

        // Chassis & Deck
        const ch = new THREE.Mesh(RG.chassis, RM.chassis);
        ch.castShadow = true;
        g.add(pin(ch, 0, cyC, 0));

        const bnd = new THREE.Mesh(RG.band, teamMat.band);
        bnd.castShadow = true;
        g.add(pin(bnd, 0, RS.deckY - 0.02, 0));

        g.add(pin(new THREE.Mesh(RG.deck, RM.dark), 0, RS.deckY + 0.006, 0));
        g.add(pin(new THREE.Mesh(RG.bumper, teamMat.band), 0, cyC - 0.02, RS.chassis.l / 2 + 0.01));

        // Mecanum-style Wheels with diagonal rollers
        const wx = RS.chassis.w / 2 + RS.wheel.w / 2 + 0.004;
        const wz = RS.chassis.l / 2 - 0.09;
        [[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]].forEach(([x, z], i) => {
            const wGroup = new THREE.Group();
            wGroup.position.set(x, RS.wheel.r, z);
            wGroup.add(new THREE.Mesh(RG.wheel, RM.wheel));
            for (let k = 0; k < 6; k++) {
                const r = new THREE.Mesh(RG.roller, RM.roller);
                const a = (k / 6) * Math.PI * 2;
                r.position.set(0, Math.cos(a) * (RS.wheel.r - 0.006), Math.sin(a) * (RS.wheel.r - 0.006));
                r.rotation.set(a, ((i % 2) ? 1 : -1) * 0.6, 0);
                wGroup.add(r);
            }
            g.add(wGroup);
        });

        // Telescoping Mast
        const m1 = new THREE.Mesh(RG.mast1, RM.dark);
        m1.castShadow = true;
        g.add(pin(m1, 0, 0.035 + (RS.stage1H - 0.04) / 2, RS.mastZ));

        const mast2 = new THREE.Mesh(RG.mast2, RM.mast2);
        mast2.position.set(0, 0.28, RS.mastZ);
        mast2.castShadow = true;
        g.add(mast2);

        const mastCap = new THREE.Mesh(RG.mastCap, teamMat.cap);
        mastCap.position.set(0, 0.68, RS.mastZ);
        g.add(mastCap);

        // Carriage & Gripper
        const carriage = new THREE.Group();
        carriage.position.y = RS.liftFoot + 0.30;
        carriage.add(pin(new THREE.Mesh(RG.plate, roleMat.plate), 0, 0, RS.mastZ + 0.055));
        carriage.add(pin(new THREE.Mesh(RG.sleeve, RM.dark), 0, 0, RS.mastZ + 0.11));

        const tube = new THREE.Mesh(RG.slide, RM.slide);
        tube.position.set(0, 0, RS.mastZ + 0.14);
        carriage.add(tube);

        const armSlide = new THREE.Group();
        armSlide.add(pin(new THREE.Mesh(RG.rail, RM.dark), 0, 0.08, RS.anchorZ0 - 0.09));

        const jawL = new THREE.Group();
        jawL.add(pin(new THREE.Mesh(RG.jaw, RM.jaw), 0, 0, RS.anchorZ0));
        jawL.position.x = -0.12;

        const jawR = new THREE.Group();
        jawR.add(pin(new THREE.Mesh(RG.jaw, RM.jaw), 0, 0, RS.anchorZ0));
        jawR.position.x = 0.12;

        armSlide.add(jawL, jawR);
        carriage.add(armSlide);
        g.add(carriage);

        // Magazine Cage on deck
        const slots = new THREE.Group();
        slots.position.set(0, 0, RS.magazineZ);
        const postH = isBuilder ? 0.36 : 0.50;
        [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]].forEach(([x, z]) => {
            const p = new THREE.Mesh(RG.post, RM.post);
            p.scale.y = postH;
            slots.add(pin(p, x, RS.deckY + postH / 2, z));
        });
        g.add(slots);

        // Status Beacon & Flag
        const beacon = new THREE.Mesh(RG.beacon, roleMat.beacon);
        g.add(pin(beacon, 0.19, RS.deckY + 0.04, -0.24));
        g.add(pin(new THREE.Mesh(RG.flag, roleMat.flag), -0.2, RS.deckY + 0.06, -0.20));

        // 2D LiDAR Scanner on Builder Robot
        if (isBuilder) {
            g.add(pin(new THREE.Mesh(RG.puck, RM.puck), 0, RS.deckY + 0.03, RS.chassis.l / 2 - 0.05));
        }

        scene.add(g);
        return g;
    }

    const robotsGroup = new THREE.Group();
    scene.add(robotsGroup);

    // Robots facing +X (toward field center): rotation.y = Math.PI / 2
    // Red TR in Zone 1 (-5.15, -5.15)
    const trRed = makeExactRobot(C.earthR, false);
    trRed.position.set(-5.15, 0, -5.15);
    trRed.rotation.y = Math.PI / 2;
    robotsGroup.add(trRed);

    // Red BR in Zone 2 (-5.15, -4.35)
    const brRed = makeExactRobot(C.earthR, true);
    brRed.position.set(-5.15, 0, -4.35);
    brRed.rotation.y = Math.PI / 2;
    robotsGroup.add(brRed);

    // Blue TR in Zone 1 (-5.15, +5.15)
    const trBlue = makeExactRobot(C.earthB, false);
    trBlue.position.set(-5.15, 0, 5.15);
    trBlue.rotation.y = Math.PI / 2;
    robotsGroup.add(trBlue);

    // Blue BR in Zone 2 (-5.15, +4.35)
    const brBlue = makeExactRobot(C.earthB, true);
    brBlue.position.set(-5.15, 0, 4.35);
    brBlue.rotation.y = Math.PI / 2;
    robotsGroup.add(brBlue);

    // =========================================================================
    // CAMERA CONTROLLER & ORBIT SYSTEM
    // =========================================================================
    const cam = {
        target: new THREE.Vector3(0, 0.6, 0),
        radius: 17,
        theta: Math.PI * 0.25,
        phi: Math.PI * 0.36,
        animT: 1,
        from: null as any,
        to: null as any,
    };

    function applyCam() {
        const r = cam.radius;
        const ph = cam.phi;
        const th = cam.theta;
        camera.position.set(
            cam.target.x + r * Math.sin(ph) * Math.sin(th),
            cam.target.y + r * Math.cos(ph),
            cam.target.z + r * Math.sin(ph) * Math.cos(th)
        );
        camera.lookAt(cam.target);
        if (scene.fog) {
            scene.fog.near = r * 1.35;
            scene.fog.far = r * 3.2;
        }
    }
    applyCam();

    function focusTo(
        target: [number, number, number],
        radius: number,
        theta?: number,
        phi?: number
    ) {
        cam.from = {
            target: cam.target.clone(),
            radius: cam.radius,
            theta: cam.theta,
            phi: cam.phi,
        };
        let th = theta === undefined ? cam.theta : theta;
        while (th - cam.theta > Math.PI) th -= Math.PI * 2;
        while (th - cam.theta < -Math.PI) th += Math.PI * 2;
        cam.to = {
            target: new THREE.Vector3(...target),
            radius,
            theta: th,
            phi: phi === undefined ? cam.phi : phi,
        };
        cam.animT = 0;
    }

    // Input handlers for Orbit
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let isAutoRotating = false;

    function onDown(x: number, y: number) {
        dragging = true;
        lastX = x;
        lastY = y;
    }

    function onMove(x: number, y: number) {
        if (!dragging) return;
        const dx = (x - lastX) / (canvas.clientWidth || 800);
        const dy = (y - lastY) / (canvas.clientHeight || 550);
        cam.theta -= dx * 3.0;
        cam.phi = Math.max(0.05, Math.min(Math.PI * 0.49, cam.phi - dy * 2.4));
        lastX = x;
        lastY = y;
        cam.animT = 1;
        applyCam();
    }

    function onUp() {
        dragging = false;
    }

    const onMouseDown = (e: MouseEvent) => onDown(e.clientX, e.clientY);
    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const onMouseUp = () => onUp();
    const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        cam.radius = Math.max(2.5, Math.min(36, cam.radius * (1 + Math.sign(e.deltaY) * 0.08)));
        cam.animT = 1;
        applyCam();
    };

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    // Touch events
    let touchTap: [number, number] | null = null;
    let pinchDist = 0;

    const onTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 1) {
            touchTap = [e.touches[0].clientX, e.touches[0].clientY];
            onDown(e.touches[0].clientX, e.touches[0].clientY);
        } else if (e.touches.length === 2) {
            pinchDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            touchTap = null;
        }
    };

    const onTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 1) {
            if (
                touchTap &&
                Math.hypot(e.touches[0].clientX - touchTap[0], e.touches[0].clientY - touchTap[1]) > 8
            ) {
                touchTap = null;
            }
            onMove(e.touches[0].clientX, e.touches[0].clientY);
        } else if (e.touches.length === 2) {
            const d2 = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            if (pinchDist) {
                cam.radius = Math.max(2.5, Math.min(36, cam.radius * (pinchDist / d2)));
                applyCam();
            }
            pinchDist = d2;
        }
    };

    const onTouchEnd = () => {
        onUp();
    };

    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd, { passive: true });

    // Raycaster for object clicking
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onClick = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(scene.children, true);

        for (const hit of hits) {
            const partId = meshToPartId.get(hit.object);
            if (partId && ARENA_PARTS[partId]) {
                selectPart(partId);
                onSelectPart(ARENA_PARTS[partId]);
                break;
            }
        }
    };
    canvas.addEventListener("click", onClick);

    // Selected object outline / highlight box
    let activeHighlight: any = null;
    function highlightMesh(mesh: any) {
        if (activeHighlight) {
            scene.remove(activeHighlight);
            activeHighlight = null;
        }
        if (!mesh) return;

        const box3 = new THREE.Box3().setFromObject(mesh);
        activeHighlight = new THREE.Box3Helper(box3, 0xfacc15);
        scene.add(activeHighlight);
    }

    function selectPart(partId: string) {
        const item = partsMap.get(partId);
        if (!item) return;

        const p = item.info;
        focusTo(p.camera.target, p.camera.radius, p.camera.theta, p.camera.phi);
        if (item.mesh) {
            highlightMesh(item.mesh);
        }
    }

    function clearSelection() {
        if (activeHighlight) {
            scene.remove(activeHighlight);
            activeHighlight = null;
        }
    }

    // Demo Tower Assembly on Building Spot (-2.0, 0.61, -2.25)
    let demoTowerBlocks: any[] = [];
    function resetDemoTower() {
        demoTowerBlocks.forEach((b) => scene.remove(b));
        demoTowerBlocks = [];
    }

    function demoAssembleTower() {
        resetDemoTower();
        const px = -2.0;
        const pz = -2.25;
        const y0 = 0.61;

        // Layer 1 Earth
        const b1 = box(0.35, 0.35, 0.35, C.earthR, px, y0 + 0.175, pz);
        // Layer 2 Earth
        const b2 = box(0.35, 0.35, 0.35, C.earthR, px, y0 + 0.175 + 0.35, pz);
        // Layer 3 Sky
        const b3 = box(0.2, 0.2, 0.2, C.skyR, px, y0 + 0.70 + 0.10, pz);

        demoTowerBlocks = [b1, b2, b3];
        focusTo([px, y0 + 0.5, pz], 4.2, Math.PI * 0.25, Math.PI * 0.35);
    }

    // Animation Render Loop
    let animId: number;
    const render = () => {
        animId = requestAnimationFrame(render);

        // Smooth camera transition
        if (cam.animT < 1) {
            cam.animT = Math.min(1, cam.animT + 0.04);
            const ease = 0.5 - 0.5 * Math.cos(cam.animT * Math.PI);

            cam.target.lerpVectors(cam.from.target, cam.to.target, ease);
            cam.radius = cam.from.radius + (cam.to.radius - cam.from.radius) * ease;
            cam.theta = cam.from.theta + (cam.to.theta - cam.from.theta) * ease;
            cam.phi = cam.from.phi + (cam.to.phi - cam.from.phi) * ease;

            applyCam();
        } else if (isAutoRotating) {
            cam.theta += 0.003;
            applyCam();
        }

        renderer.render(scene, camera);
    };
    render();

    return {
        destroy: () => {
            cancelAnimationFrame(animId);
            canvas.removeEventListener("mousedown", onMouseDown);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
            canvas.removeEventListener("wheel", onWheel);
            canvas.removeEventListener("touchstart", onTouchStart);
            canvas.removeEventListener("touchmove", onTouchMove);
            canvas.removeEventListener("touchend", onTouchEnd);
            canvas.removeEventListener("click", onClick);
            renderer.dispose();
        },
        resize: (w: number, h: number) => {
            if (w <= 0 || h <= 0) return;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            applyCam();
        },
        focusTo,
        selectPart,
        clearSelection,
        setWireframe: (wf: boolean) => {
            scene.traverse((obj: any) => {
                if (obj.isMesh && obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach((m: any) => (m.wireframe = wf));
                    } else {
                        obj.material.wireframe = wf;
                    }
                }
            });
        },
        setIsolate: (isolate: boolean) => {
            scene.traverse((obj: any) => {
                if (obj.isMesh && obj.material && obj !== activeHighlight) {
                    const m = obj.material;
                    if (!Array.isArray(m)) {
                        m.transparent = isolate;
                        m.opacity = isolate ? 0.25 : 1.0;
                    }
                }
            });
        },
        setRobotsVisible: (visible: boolean) => {
            robotsGroup.visible = visible;
        },
        setAutoRotate: (autoRotate: boolean) => {
            isAutoRotating = autoRotate;
        },
        setPresetView: (view: "iso" | "top" | "side" | "red" | "blue" | "summit") => {
            switch (view) {
                case "iso":
                    focusTo([0, 0.6, 0], 17, Math.PI * 0.25, Math.PI * 0.36);
                    break;
                case "top":
                    focusTo([0, 0.6, 0], 21, 0, 0.05);
                    break;
                case "side":
                    focusTo([0, 0.8, 0], 18, Math.PI * 0.5, Math.PI * 0.49);
                    break;
                case "red":
                    focusTo([0, 0.6, -2.5], 13, Math.PI, Math.PI * 0.36);
                    break;
                case "blue":
                    focusTo([0, 0.6, 2.5], 13, 0, Math.PI * 0.36);
                    break;
                case "summit":
                    focusTo([0, 1.2, 0], 6.5, Math.PI * 0.25, Math.PI * 0.36);
                    break;
            }
        },
        demoAssembleTower,
        resetDemoTower,
        takeScreenshot: () => {
            renderer.render(scene, camera);
            return canvas.toDataURL("image/png");
        },
    };
}

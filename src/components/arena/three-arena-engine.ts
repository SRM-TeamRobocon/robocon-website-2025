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
    setMatchSimStage: (stage: "start" | "harvest" | "place_earth" | "cap_tower" | "enshrine_mustika" | "reset") => void;
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
    // Ground Shared Area pad: One Red half (z < 0) and One Blue half (z > 0)
    // 5x5 grid of 200mm cells, 12 Sky Blocks distributed randomly between Red and Blue
    // =========================================================================
    const skyPadR = box(1.2, 0.02, 0.6, 0xd92626, -4.25, 0.01, -0.3); // Red half
    const skyPadB = box(1.2, 0.02, 0.6, 0x2563eb, -4.25, 0.01, 0.3);  // Blue half
    // Boundary rim for Ground Shared Area
    box(1.24, 0.022, 0.03, 0x7f1d1d, -4.25, 0.012, -0.6);
    box(1.24, 0.022, 0.03, 0x1e3a8a, -4.25, 0.012, 0.6);
    box(0.03, 0.022, 0.62, 0x7f1d1d, -4.85, 0.012, -0.3);
    box(0.03, 0.022, 0.62, 0x1e3a8a, -4.85, 0.012, 0.3);
    box(0.03, 0.022, 0.62, 0x7f1d1d, -3.65, 0.012, -0.3);
    box(0.03, 0.022, 0.62, 0x1e3a8a, -3.65, 0.012, 0.3);
    registerPart("skyarea", skyPadR, ARENA_PARTS.skyarea);

    const skyGroup = new THREE.Group();
    scene.add(skyGroup);
    const skyGeom = new THREE.BoxGeometry(0.2, 0.2, 0.2);

    const sMatR = mat(C.skyR, { roughness: 0.55 });
    const sMatB = mat(C.skyB, { roughness: 0.55 });

    // Official Rulebook Appendix Fig 4 cell layout (12 blocks)
    const skyLayout = [
        { r: 0, c: 0 }, { r: 0, c: 2 }, { r: 0, c: 4 },
        { r: 1, c: 1 },                 { r: 1, c: 3 },
        { r: 2, c: 0 },                                 { r: 2, c: 4 },
        { r: 3, c: 1 },                 { r: 3, c: 3 },
        { r: 4, c: 0 }, { r: 4, c: 2 }, { r: 4, c: 4 },
    ];

    // Random distribution of Red and Blue blocks (6 Red blocks, 6 Blue blocks)
    const skyColors = [
        C.skyR, C.skyB, C.skyR,
        C.skyB, C.skyR,
        C.skyB,         C.skyR,
        C.skyR, C.skyB,
        C.skyB, C.skyR, C.skyB,
    ];

    let firstSky: any = null;
    skyLayout.forEach((cell, i) => {
        const px = -4.25 + (2 - cell.r) * 0.20;
        const pz = (cell.c - 2) * 0.20;
        const sMat = skyColors[i] === C.skyR ? sMatR : sMatB;

        const sMesh = new THREE.Mesh(skyGeom, sMat);
        sMesh.position.set(px, 0.1, pz);
        sMesh.castShadow = true;
        sMesh.receiveShadow = true;
        skyGroup.add(sMesh);
        if (!firstSky) firstSky = sMesh;
    });
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

    // Two Shared Areas on Level 1 (0.75m in X x 1.0m in Z) - ONE RED, ONE BLUE per user request:
    // Sits flush from x = +/-2.25 to +/-3.00m, exactly within Level 1 (NOT extending outside!)
    const sharedPad1 = box(0.75, 0.022, 1.0, 0xd92626, -2.625, 0.611, 0); // Red Shared Area
    const sharedPad2 = box(0.75, 0.022, 1.0, 0x2563eb, 2.625, 0.611, 0);  // Blue Shared Area
    // Boundary rims
    box(0.75, 0.025, 0.03, 0x7f1d1d, -2.625, 0.613, -0.5);
    box(0.75, 0.025, 0.03, 0x7f1d1d, -2.625, 0.613, 0.5);
    box(0.75, 0.025, 0.03, 0x1e3a8a, 2.625, 0.613, -0.5);
    box(0.75, 0.025, 0.03, 0x1e3a8a, 2.625, 0.613, 0.5);

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

    // Exclusive L1 Spots (4 spots matching F.spots)
    const exclusiveSpotsL1 = [
        [-2.75, 0.612, -2.75], // Red L1 Spot 1 (L1.R.W)
        [2.75, 0.612, -2.75],  // Red L1 Spot 2 (L1.R.E)
        [-2.75, 0.612, 2.75],  // Blue L1 Spot 1 (L1.B.W)
        [2.75, 0.612, 2.75],   // Blue L1 Spot 2 (L1.B.E)
    ];
    exclusiveSpotsL1.forEach(([x, y, z]) => {
        const sm = new THREE.Mesh(spotGeom, spotMat);
        sm.position.set(x, y, z);
        sm.receiveShadow = true;
        scene.add(sm);
        if (!firstSpot) firstSpot = sm;
    });

    // The 2 Shared Building Spots on Level 1: One Red (-2.625) and One Blue (+2.625)
    // Sits on the Shared Area pads, exactly contained within Level 1
    const sharedSpotGeom = new THREE.BoxGeometry(0.50, 0.024, 0.50);
    const sharedInnerGeom = new THREE.BoxGeometry(0.38, 0.025, 0.38);

    // Red Spot on Red Shared Area (-2.625)
    const spotBorderR = new THREE.Mesh(sharedSpotGeom, mat(0xef4444, { roughness: 0.5 }));
    spotBorderR.position.set(-2.625, 0.612, 0);
    spotBorderR.receiveShadow = true;
    scene.add(spotBorderR);
    const spotInnerR = new THREE.Mesh(sharedInnerGeom, mat(0x3a1215, { roughness: 0.8 }));
    spotInnerR.position.set(-2.625, 0.613, 0);
    spotInnerR.receiveShadow = true;
    scene.add(spotInnerR);

    // Blue Spot on Blue Shared Area (+2.625)
    const spotBorderB = new THREE.Mesh(sharedSpotGeom, mat(0x3b82f6, { roughness: 0.5 }));
    spotBorderB.position.set(2.625, 0.612, 0);
    spotBorderB.receiveShadow = true;
    scene.add(spotBorderB);
    const spotInnerB = new THREE.Mesh(sharedInnerGeom, mat(0x131e33, { roughness: 0.8 }));
    spotInnerB.position.set(2.625, 0.613, 0);
    spotInnerB.receiveShadow = true;
    scene.add(spotInnerB);

    // 4 Exclusive Spots on Level 2 (elevation y = 0.912)
    const spotsL2 = [
        [-1.25, 0.912, -1.25],
        [1.25, 0.912, -1.25],
        [-1.25, 0.912, 1.25],
        [1.25, 0.912, 1.25],
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
    // 12. EXACT ROBOTS & PARKING (Reconstructed from Reference robots3d.js)
    // Red TR: (-5.15, 0, -5.15), Red BR: (-5.15, 0, -4.35) -> Facing +X
    // Blue TR: (-5.15, 0, +5.15), Blue BR: (-5.15, 0, +4.35) -> Facing +X
    // =========================================================================
    const RS = {
        start: { l: 0.70, w: 0.70, h: 0.70 },
        maxExt: { w: 1.00, l: 1.40, h: 1.20 },
        massLimit: 50,
        chassis: { l: 0.56, w: 0.50, h: 0.13, clear: 0.045 },
        wheel: { r: 0.075, w: 0.05 },
        deckY: 0.175,
        mastZ: 0.20,
        stage1H: 0.66,
        stage2Max: 0.48,
        liftFoot: 0.08,
        anchorZ0: 0.30,
        armMax: 0.45,
        lift: { tr: 0.95, br: 1.00 },
        magazineZ: -0.09,
    };

    const POSE_REST = { carriageY: 0.30, armExtend: 0, gripOpen: 0.06, wheelSpin: 0 };

    const RG = {
        chassis: new THREE.BoxGeometry(RS.chassis.w, RS.chassis.h, RS.chassis.l),
        band: new THREE.BoxGeometry(RS.chassis.w + 0.012, 0.035, RS.chassis.l + 0.012),
        deck: new THREE.BoxGeometry(RS.chassis.w - 0.04, 0.012, RS.chassis.l - 0.04),
        wheel: new THREE.CylinderGeometry(RS.wheel.r, RS.wheel.r, RS.wheel.w, 18).rotateZ(Math.PI / 2),
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
        chassis: mat(0x1c1a16, { metalness: 0.40, roughness: 0.50 }),
        dark: mat(0x2c2a24, { metalness: 0.50 }),
        wheel: mat(0x121110, { roughness: 0.85, metalness: 0.10 }),
        roller: mat(0x4a4740, { roughness: 0.6, metalness: 0.3 }),
        mast2: mat(0x9c9486, { metalness: 0.65, roughness: 0.35 }),
        slide: mat(0x7d7566, { metalness: 0.6 }),
        jaw: mat(0x8f8779, { metalness: 0.55 }),
        post: mat(0x5a564c, { metalness: 0.5 }),
        puck: mat(0x111111, { roughness: 0.3, metalness: 0.2 }),
    };

    function teamMats(c: number) {
        return {
            band: mat(c, { metalness: 0.30, roughness: 0.50 }),
            cap: mat(c, { metalness: 0.35 }),
        };
    }

    function roleMats(isBuilder: boolean) {
        return {
            plate: mat(isBuilder ? 0xc7a53a : 0x8a8578, { metalness: 0.45 }),
            flag: mat(isBuilder ? 0xc7a53a : 0x8a8578, { metalness: 0.40 }),
            beacon: new THREE.MeshStandardMaterial({
                color: isBuilder ? 0xffd66b : 0xff8a5a,
                emissive: isBuilder ? 0x8a6b1a : 0x7a2a10,
                emissiveIntensity: 0.70,
            }),
        };
    }

    function pin(o: any, x: number, y: number, z: number) {
        o.position.set(x, y, z);
        o.matrixAutoUpdate = false;
        o.updateMatrix();
        return o;
    }

    function setPose(r: any, p: any) {
        const q = r.pose;
        const cl = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
        if (p.carriageY !== undefined) q.carriageY = cl(p.carriageY, 0, r.travel);
        if (p.armExtend !== undefined) q.armExtend = cl(p.armExtend, 0, RS.armMax);
        if (p.gripOpen !== undefined) q.gripOpen = cl(p.gripOpen, 0.06, 0.44);
        if (p.wheelSpin !== undefined) q.wheelSpin = p.wheelSpin;

        const cy = RS.liftFoot + q.carriageY;
        r.carriage.position.y = cy;
        const T = Math.max(RS.start.h, Math.min(RS.maxExt.h - 0.01, cy + 0.14));
        r.mast2.position.y = T - 0.025 - (RS.stage2Max + 0.04) / 2;
        r.mastCap.position.y = T - 0.0125;
        r.armSlide.position.z = q.armExtend;

        const len = Math.max(0.02, RS.anchorZ0 - 0.10 - (RS.mastZ + 0.08) + q.armExtend);
        r.tube.scale.z = len;
        r.tube.position.z = RS.mastZ + 0.08 + len / 2;

        const j = q.gripOpen / 2 + 0.014;
        r.jawL.position.x = -j;
        r.jawR.position.x = j;
        for (const w of r.wheels) w.rotation.x = q.wheelSpin;
        return q;
    }

    function makeExactRobot(teamColor: number, isBuilder: boolean) {
        const tm = teamMats(teamColor);
        const rm = roleMats(isBuilder);
        const type = isBuilder ? "br" : "tr";
        const g = new THREE.Group();
        const cyC = RS.chassis.clear + RS.chassis.h / 2;

        // Chassis & deck
        const chassis = new THREE.Mesh(RG.chassis, RM.chassis);
        chassis.castShadow = true;
        g.add(pin(chassis, 0, cyC, 0));

        const band = new THREE.Mesh(RG.band, tm.band);
        band.castShadow = true;
        g.add(pin(band, 0, RS.deckY - 0.02, 0));

        g.add(pin(new THREE.Mesh(RG.deck, RM.dark), 0, RS.deckY + 0.006, 0));
        g.add(pin(new THREE.Mesh(RG.bumper, tm.band), 0, cyC - 0.02, RS.chassis.l / 2 + 0.01));

        // Mecanum-style Wheels
        const wx = RS.chassis.w / 2 + RS.wheel.w / 2 + 0.004;
        const wz = RS.chassis.l / 2 - 0.09;
        const wheels = [[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]].map(([x, z], i) => {
            const w = new THREE.Group();
            w.position.set(x, RS.wheel.r, z);
            w.add(new THREE.Mesh(RG.wheel, RM.wheel));
            for (let k = 0; k < 6; k++) {
                const r = new THREE.Mesh(RG.roller, RM.roller);
                const a = (k / 6) * Math.PI * 2;
                r.position.set(0, Math.cos(a) * (RS.wheel.r - 0.006), Math.sin(a) * (RS.wheel.r - 0.006));
                r.rotation.set(a, ((i % 2) ? 1 : -1) * 0.6, 0);
                w.add(r);
            }
            g.add(w);
            return w;
        });

        // Mast stage 1 fixed
        const m1 = new THREE.Mesh(RG.mast1, RM.dark);
        m1.castShadow = true;
        g.add(pin(m1, 0, 0.035 + (RS.stage1H - 0.04) / 2, RS.mastZ));

        // Mast stage 2 telescoping
        const mast2 = new THREE.Mesh(RG.mast2, RM.mast2);
        mast2.position.set(0, 0, RS.mastZ);
        mast2.castShadow = true;
        g.add(mast2);

        const mastCap = new THREE.Mesh(RG.mastCap, tm.cap);
        mastCap.position.set(0, 0, RS.mastZ);
        g.add(mastCap);

        // Carriage & Gripper mechanism
        const carriage = new THREE.Group();
        g.add(carriage);
        carriage.add(pin(new THREE.Mesh(RG.plate, rm.plate), 0, 0, RS.mastZ + 0.055));
        carriage.add(pin(new THREE.Mesh(RG.sleeve, RM.dark), 0, 0, RS.mastZ + 0.11));

        const tube = new THREE.Mesh(RG.slide, RM.slide);
        carriage.add(tube);

        const armSlide = new THREE.Group();
        carriage.add(armSlide);
        armSlide.add(pin(new THREE.Mesh(RG.rail, RM.dark), 0, 0.08, RS.anchorZ0 - 0.09));

        const jawL = new THREE.Group();
        jawL.add(pin(new THREE.Mesh(RG.jaw, RM.jaw), 0, 0, RS.anchorZ0));
        const jawR = new THREE.Group();
        jawR.add(pin(new THREE.Mesh(RG.jaw, RM.jaw), 0, 0, RS.anchorZ0));
        armSlide.add(jawL, jawR);

        const anchor = new THREE.Object3D();
        anchor.position.set(0, 0, RS.anchorZ0);
        armSlide.add(anchor);

        // Magazine cage on deck
        const slots = new THREE.Group();
        slots.position.set(0, 0, RS.magazineZ);
        g.add(slots);
        const postH = isBuilder ? 0.36 : 0.50;
        [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]].forEach(([x, z]) => {
            const p = new THREE.Mesh(RG.post, RM.post);
            p.scale.y = postH;
            slots.add(pin(p, x, RS.deckY + postH / 2, z));
        });

        // Beacon & Flag
        const beacon = new THREE.Mesh(RG.beacon, rm.beacon);
        g.add(pin(beacon, 0.19, RS.deckY + 0.04, -0.24));
        g.add(pin(new THREE.Mesh(RG.flag, rm.flag), -0.2, RS.deckY + 0.06, -0.20));

        // 2D LiDAR scanner on BR
        if (isBuilder) {
            g.add(pin(new THREE.Mesh(RG.puck, RM.puck), 0, RS.deckY + 0.03, RS.chassis.l / 2 - 0.05));
        }

        scene.add(g);

        const r = {
            g,
            carriage,
            armSlide,
            tube,
            jawL,
            jawR,
            anchor,
            slots,
            wheels,
            beacon,
            mast2,
            mastCap,
            isBuilder,
            type,
            travel: RS.lift[type as "tr" | "br"],
            pose: Object.assign({}, POSE_REST),
        };
        setPose(r, POSE_REST);
        return g;
    }

    const robotsGroup = new THREE.Group();
    scene.add(robotsGroup);

    // Robots facing +X (toward field center): rotation.y = Math.PI / 2
    // Red TR in Zone 1 (-5.15, -5.15)
    const trRed = makeExactRobot(0xdf2222, false);
    trRed.position.set(-5.15, 0, -5.15);
    trRed.rotation.y = Math.PI / 2;
    robotsGroup.add(trRed);

    // Red BR in Zone 2 (-5.15, -4.35)
    const brRed = makeExactRobot(0xdf2222, true);
    brRed.position.set(-5.15, 0, -4.35);
    brRed.rotation.y = Math.PI / 2;
    robotsGroup.add(brRed);

    // Blue TR in Zone 1 (-5.15, +5.15)
    const trBlue = makeExactRobot(0x3200ff, false);
    trBlue.position.set(-5.15, 0, 5.15);
    trBlue.rotation.y = Math.PI / 2;
    robotsGroup.add(trBlue);

    // Blue BR in Zone 2 (-5.15, +4.35)
    const brBlue = makeExactRobot(0x3200ff, true);
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
        if (touchTap) {
            const rect = canvas.getBoundingClientRect();
            mouse.x = ((touchTap[0] - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((touchTap[1] - rect.top) / rect.height) * 2 + 1;

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
            touchTap = null;
        }
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

    // Demo Tower Assembly on Building Spot L1.R.W (-2.75, 0.61, -2.75)
    let demoTowerBlocks: any[] = [];
    function resetDemoTower() {
        demoTowerBlocks.forEach((b) => scene.remove(b));
        demoTowerBlocks = [];
    }

    function demoAssembleTower() {
        resetDemoTower();
        const px = -2.75;
        const pz = -2.75;
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

    // Match Simulation 3D dynamic stage objects
    const matchSimGroup = new THREE.Group();
    scene.add(matchSimGroup);
    let enshrinedMustikaMesh: any = null;
    let victoryLight: any = null;

    function setMatchSimStage(stage: "start" | "harvest" | "place_earth" | "cap_tower" | "enshrine_mustika" | "reset") {
        while (matchSimGroup.children.length > 0) {
            matchSimGroup.remove(matchSimGroup.children[0]);
        }
        if (enshrinedMustikaMesh) {
            scene.remove(enshrinedMustikaMesh);
            enshrinedMustikaMesh = null;
        }
        if (victoryLight) {
            scene.remove(victoryLight);
            victoryLight = null;
        }

        if (stage === "reset" || stage === "start") {
            trRed.position.set(-5.15, 0, -5.15);
            trRed.rotation.y = Math.PI / 2;
            brRed.position.set(-5.15, 0, -4.35);
            brRed.rotation.y = Math.PI / 2;
            trBlue.position.set(-5.15, 0, 5.15);
            trBlue.rotation.y = Math.PI / 2;
            brBlue.position.set(-5.15, 0, 4.35);
            brBlue.rotation.y = Math.PI / 2;

            mSphereGround.visible = true;
            focusTo([0, 0.6, 0], 16, Math.PI * 0.25, Math.PI * 0.36);
        } else if (stage === "harvest") {
            mSphereGround.visible = true;

            trRed.position.set(-1.30, 0.60, -3.5);
            trRed.rotation.y = 0;
            brRed.position.set(-1.95, 0.60, -3.5);
            brRed.rotation.y = 0;

            trBlue.position.set(-1.30, 0.60, 3.5);
            trBlue.rotation.y = 0;
            brBlue.position.set(-1.95, 0.60, 3.5);
            brBlue.rotation.y = 0;

            const e1 = box(0.35, 0.35, 0.35, C.earthR, -1.30, 0.60 + 0.175, -3.15);
            const e2 = box(0.35, 0.35, 0.35, C.earthB, -1.30, 0.60 + 0.175, 3.15);
            matchSimGroup.add(e1, e2);

            focusTo([-1.30, 0.80, -3.5], 5.8, Math.PI * 0.45, Math.PI * 0.36);
        } else if (stage === "place_earth") {
            mSphereGround.visible = true;

            trRed.position.set(-3.5, 0, -3.5);
            trRed.rotation.y = Math.PI / 2;
            brRed.position.set(-2.25, 0.60, -2.75);
            brRed.rotation.y = -Math.PI / 2;

            trBlue.position.set(-3.5, 0, 3.5);
            trBlue.rotation.y = Math.PI / 2;
            brBlue.position.set(-2.25, 0.60, 2.75);
            brBlue.rotation.y = -Math.PI / 2;

            const b1 = box(0.35, 0.35, 0.35, C.earthR, -2.75, 0.61 + 0.175, -2.75);
            const b2 = box(0.35, 0.35, 0.35, C.earthR, -2.75, 0.61 + 0.525, -2.75);
            const bb1 = box(0.35, 0.35, 0.35, C.earthB, -2.75, 0.61 + 0.175, 2.75);
            const bb2 = box(0.35, 0.35, 0.35, C.earthB, -2.75, 0.61 + 0.525, 2.75);
            matchSimGroup.add(b1, b2, bb1, bb2);

            focusTo([-2.75, 0.95, -2.75], 4.8, Math.PI * 0.25, Math.PI * 0.35);
        } else if (stage === "cap_tower") {
            mSphereGround.visible = true;

            trRed.position.set(-4.25, 0, -1.0);
            trRed.rotation.y = 0;
            brRed.position.set(-2.20, 0.60, -2.75);
            brRed.rotation.y = -Math.PI / 2;

            brBlue.position.set(-2.20, 0.60, 2.75);
            brBlue.rotation.y = -Math.PI / 2;

            const b1 = box(0.35, 0.35, 0.35, C.earthR, -2.75, 0.61 + 0.175, -2.75);
            const b2 = box(0.35, 0.35, 0.35, C.earthR, -2.75, 0.61 + 0.525, -2.75);
            const b3 = box(0.20, 0.20, 0.20, C.skyR, -2.75, 0.61 + 0.70 + 0.10, -2.75);

            const bb1 = box(0.35, 0.35, 0.35, C.earthB, -2.75, 0.61 + 0.175, 2.75);
            const bb2 = box(0.35, 0.35, 0.35, C.earthB, -2.75, 0.61 + 0.525, 2.75);
            const bb3 = box(0.20, 0.20, 0.20, C.skyB, -2.75, 0.61 + 0.70 + 0.10, 2.75);
            matchSimGroup.add(b1, b2, b3, bb1, bb2, bb3);

            focusTo([-2.75, 1.25, -2.75], 4.2, Math.PI * 0.20, Math.PI * 0.34);
        } else if (stage === "enshrine_mustika") {
            mSphereGround.visible = false;

            const b1 = box(0.35, 0.35, 0.35, C.earthR, -2.75, 0.61 + 0.175, -2.75);
            const b2 = box(0.35, 0.35, 0.35, C.earthR, -2.75, 0.61 + 0.525, -2.75);
            const b3 = box(0.20, 0.20, 0.20, C.skyR, -2.75, 0.61 + 0.70 + 0.10, -2.75);
            matchSimGroup.add(b1, b2, b3);

            brRed.position.set(-0.65, 0.90, 0);
            brRed.rotation.y = Math.PI / 2;

            enshrinedMustikaMesh = new THREE.Mesh(
                new THREE.SphereGeometry(0.105, 32, 24),
                new THREE.MeshStandardMaterial({
                    color: 0xfacc15,
                    emissive: 0xd97706,
                    emissiveIntensity: 0.9,
                    roughness: 0.25,
                    metalness: 0.3,
                })
            );
            enshrinedMustikaMesh.position.set(0, 1.74, 0);
            enshrinedMustikaMesh.castShadow = true;
            scene.add(enshrinedMustikaMesh);

            victoryLight = new THREE.PointLight(0xfacc15, 2.0, 6.0);
            victoryLight.position.set(0, 2.0, 0);
            scene.add(victoryLight);

            focusTo([0, 1.5, 0], 4.5, Math.PI * 0.15, Math.PI * 0.35);
        }
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
        setMatchSimStage,
        takeScreenshot: () => {
            renderer.render(scene, camera);
            return canvas.toDataURL("image/png");
        },
    };
}

import * as THREE from 'three';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue background

// Add fog for depth perception
scene.fog = new THREE.FogExp2(0x87CEEB, 0.01);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Drone properties
const droneState = {
    position: new THREE.Vector3(0, 5, 0),
    rotation: new THREE.Euler(0, 0, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    rotationVelocity: new THREE.Euler(0, 0, 0),
    propellerRotation: 0,
    beginnerMode: false,
    mouseX: 0,
    mouseY: 0
};

// Mouse lock and movement handling
let isPointerLocked = false;

// Request pointer lock when clicking on the game
document.addEventListener('click', () => {
    if (!isPointerLocked) {
        document.body.requestPointerLock();
    }
});

// Handle pointer lock change
document.addEventListener('pointerlockchange', () => {
    isPointerLocked = document.pointerLockElement === document.body;
});

// Mouse movement handler using pointer lock
document.addEventListener('mousemove', (event) => {
    if (isPointerLocked && droneState.beginnerMode) {
        // Use movementX/Y for relative mouse movement with inverted horizontal controls
        droneState.mouseX -= event.movementX * 0.0005;  // Inverted horizontal movement
        droneState.mouseY -= event.movementY * 0.0005;  // Vertical stays the same
    } else if (!droneState.beginnerMode) {
        // Normal mode - reset mouse position
        droneState.mouseX = 0;
        droneState.mouseY = 0;
    }
});

// Create drone model
const droneBody = new THREE.Group();

// Main body
const bodyGeometry = new THREE.BoxGeometry(1, 0.2, 1);
const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
droneBody.add(body);

// Arms for propellers
const armGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.5);
const armMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });

// Create 4 arms
const armPositions = [
    { x: 0.4, z: 0.4, rotation: Math.PI / 4 },
    { x: -0.4, z: 0.4, rotation: -Math.PI / 4 },
    { x: 0.4, z: -0.4, rotation: -Math.PI / 4 },
    { x: -0.4, z: -0.4, rotation: Math.PI / 4 }
];

armPositions.forEach(pos => {
    const arm = new THREE.Mesh(armGeometry, armMaterial);
    arm.position.set(pos.x, 0, pos.z);
    arm.rotation.y = pos.rotation;
    droneBody.add(arm);
});

// Propellers
const propellerGeometry = new THREE.BoxGeometry(0.5, 0.05, 0.05);
const propellerMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });

// Create 4 propellers
const propellers = armPositions.map(pos => {
    const propeller = new THREE.Mesh(propellerGeometry, propellerMaterial);
    propeller.position.set(pos.x, 0.1, pos.z);
    return propeller;
});

propellers.forEach(propeller => droneBody.add(propeller));
scene.add(droneBody);

// Add lighting
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

// Create clouds
const clouds = [];
for (let i = 0; i < 50; i++) {
    const cloudGeometry = new THREE.SphereGeometry(Math.random() * 3 + 2, 8, 8);
    const cloudMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
        flatShading: true
    });
    const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
    
    // Position clouds randomly in the sky
    cloud.position.set(
        Math.random() * 200 - 100,
        Math.random() * 30 + 20,
        Math.random() * 200 - 100
    );
    cloud.scale.y = 0.5; // Flatten clouds
    clouds.push(cloud);
    scene.add(cloud);
}

// Motion trails
const trailGeometry = new THREE.BufferGeometry();
const trailMaterial = new THREE.LineBasicMaterial({ 
    color: 0x00ff00,
    transparent: true,
    opacity: 0.5
});
const trailPositions = new Float32Array(300); // Store 100 points with x,y,z each
trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
const trail = new THREE.Line(trailGeometry, trailMaterial);
scene.add(trail);
let trailIndex = 0;

// Create environment
const groundGeometry = new THREE.PlaneGeometry(200, 200, 50, 50);
const groundMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x1a472a,
    wireframe: false,
    side: THREE.DoubleSide,
    shininess: 10,
    flatShading: true
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;

// Add terrain variation
const vertices = ground.geometry.attributes.position.array;
for (let i = 0; i < vertices.length; i += 3) {
    if (i !== 1) {
        vertices[i + 1] = Math.sin(i * 0.1) * Math.cos(i * 0.1) * 3;
    }
}
ground.geometry.attributes.position.needsUpdate = true;
scene.add(ground);

// Add buildings/obstacles
const buildingCount = 20;
for (let i = 0; i < buildingCount; i++) {
    const height = Math.random() * 20 + 10;
    const width = Math.random() * 8 + 4;
    const buildingGeometry = new THREE.BoxGeometry(width, height, width);
    const buildingMaterial = new THREE.MeshPhongMaterial({ 
        color: new THREE.Color(0.3 + Math.random() * 0.7, 0.3 + Math.random() * 0.7, 0.3 + Math.random() * 0.7)
    });
    const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
    
    // Position buildings in a circular pattern
    const radius = Math.random() * 50 + 20;
    const angle = (i / buildingCount) * Math.PI * 2;
    building.position.set(
        Math.cos(angle) * radius,
        height / 2,
        Math.sin(angle) * radius
    );
    scene.add(building);
}

// Add floating rings as challenges in a specific path
const ringCount = 10;
const rings = [];
const ringPositions = [
    { x: 0, y: 10, z: -20 },
    { x: 10, y: 15, z: -30 },
    { x: 20, y: 10, z: -20 },
    { x: 20, y: 8, z: 0 },
    { x: 10, y: 12, z: 10 },
    { x: -10, y: 15, z: 10 },
    { x: -20, y: 10, z: 0 },
    { x: -20, y: 8, z: -10 },
    { x: -10, y: 12, z: -20 },
    { x: 0, y: 15, z: -10 }
];

// Create rings and arrows
for (let i = 0; i < ringCount; i++) {
    const ringGeometry = new THREE.TorusGeometry(2, 0.1, 16, 32);
    const ringMaterial = new THREE.MeshPhongMaterial({ color: 0xffff00 });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    
    // Position rings in predefined positions
    ring.position.set(
        ringPositions[i].x,
        ringPositions[i].y,
        ringPositions[i].z
    );
    
    // Rotate rings to face next ring
    if (i < ringCount - 1) {
        const nextPos = ringPositions[i + 1];
        ring.lookAt(nextPos.x, nextPos.y, nextPos.z);
    }
    
    rings.push(ring);
    scene.add(ring);

    // Add arrow pointing to next ring
    if (i < ringCount - 1) {
        const nextPos = ringPositions[i + 1];
        const direction = new THREE.Vector3(
            nextPos.x - ringPositions[i].x,
            nextPos.y - ringPositions[i].y,
            nextPos.z - ringPositions[i].z
        );
        const length = direction.length() * 0.3; // Arrow length is 30% of distance between rings
        const arrowHelper = new THREE.ArrowHelper(
            direction.normalize(),
            ring.position,
            length,
            0xff0000,
            length * 0.2,
            length * 0.1
        );
        scene.add(arrowHelper);
    }
}

// Add timer variables
let timerStarted = false;
let startTime = 0;
let ringsCollected = 0;

// Controls
const keys = {
    w: false,
    s: false,
    a: false,
    d: false,
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    ' ': false,
    Shift: false
};

window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (e.key.toLowerCase() === 'b') {
        droneState.beginnerMode = !droneState.beginnerMode;
        // Reset velocities when switching modes
        resetVelocities();
        // Update mode display
        document.getElementById('mode-display').textContent = 
            droneState.beginnerMode ? 'Beginner Mode' : 'Normal Mode';
    }
});
window.addEventListener('keyup', (e) => keys[e.key] = false);

// Physics constants
const THRUST = 0.015;
const ROTATION_SPEED = 0.05;
const DRAG = 0.90;  // Increased drag to reduce drifting
const PROPELLER_SPEED = 0.5;

// Function to stop all movement
function resetVelocities() {
    droneState.velocity.set(0, 0, 0);
    droneState.rotationVelocity.set(0, 0, 0);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Update drone physics based on mode
    if (droneState.beginnerMode) {
        // Calculate target rotations with full range of motion
        const targetRotationX = droneState.mouseY * Math.PI;  // Full range pitch
        const targetRotationY = droneState.mouseX * Math.PI * 2;  // Full 360-degree yaw
        
        // Smoothly rotate the drone to face mouse position
        droneState.rotation.x = targetRotationX;
        droneState.rotation.y = targetRotationY;
        
        // Allow some banking for more dynamic movement
        droneState.rotation.z = -droneState.mouseX * 0.5;  // Bank slightly in turns
        
        // W key controls throttle in beginner mode - moves in direction of crosshair
        if (keys.w) {
            const direction = new THREE.Vector3(0, 0, -1);
            direction.applyEuler(droneState.rotation);
            droneState.velocity.add(direction.multiplyScalar(THRUST));
        }
    } else {
        // Normal mode controls
        if (keys.w) droneState.velocity.z -= Math.cos(droneState.rotation.y) * THRUST;
        if (keys.s) droneState.velocity.z += Math.cos(droneState.rotation.y) * THRUST;
        if (keys.a) droneState.velocity.x -= THRUST;  // Move left
        if (keys.d) droneState.velocity.x += THRUST;  // Move right
        if (keys.ArrowUp) droneState.rotationVelocity.x -= ROTATION_SPEED;
        if (keys.ArrowDown) droneState.rotationVelocity.x += ROTATION_SPEED;
    }

    // Vertical controls work the same in both modes
    if (keys[' ']) droneState.velocity.y += THRUST;
    if (keys.Shift) droneState.velocity.y -= THRUST;

    // Update motion trail
    const positions = trail.geometry.attributes.position.array;
    positions[trailIndex * 3] = droneState.position.x;
    positions[trailIndex * 3 + 1] = droneState.position.y;
    positions[trailIndex * 3 + 2] = droneState.position.z;
    trailIndex = (trailIndex + 1) % 100;
    trail.geometry.attributes.position.needsUpdate = true;

    // Animate clouds
    clouds.forEach((cloud, i) => {
        cloud.position.x += Math.sin(Date.now() * 0.001 + i) * 0.05;
        cloud.position.z += Math.cos(Date.now() * 0.001 + i) * 0.05;
    });

    // Rotate propellers
    droneState.propellerRotation += PROPELLER_SPEED;
    propellers.forEach((propeller, index) => {
        propeller.rotation.y = droneState.propellerRotation + (index % 2 ? Math.PI : 0);
    });

    // Apply physics
    droneState.position.add(droneState.velocity);
    droneState.rotation.x += droneState.rotationVelocity.x;
    droneState.rotation.y += droneState.rotationVelocity.y;
    droneState.rotation.z += droneState.rotationVelocity.z;

    // Apply drag and handle no input
    droneState.velocity.multiplyScalar(DRAG);
    droneState.rotationVelocity.x *= DRAG;
    droneState.rotationVelocity.y *= DRAG;
    droneState.rotationVelocity.z *= DRAG;

    // If velocity is very small, stop completely to prevent drift
    if (droneState.velocity.length() < 0.001) {
        droneState.velocity.set(0, 0, 0);
    }
    if (Math.abs(droneState.rotationVelocity.x) < 0.001 &&
        Math.abs(droneState.rotationVelocity.y) < 0.001 &&
        Math.abs(droneState.rotationVelocity.z) < 0.001) {
        droneState.rotationVelocity.set(0, 0, 0);
    }

    // Update drone position and rotation
    droneBody.position.copy(droneState.position);
    droneBody.rotation.copy(droneState.rotation);

    // Update camera position based on mode
    if (droneState.beginnerMode) {
        // In beginner mode, camera follows drone's rotation exactly
        const cameraOffset = new THREE.Vector3(0, 0, 2);  // 2 units behind
        cameraOffset.applyEuler(droneState.rotation);
        camera.position.copy(droneState.position).add(cameraOffset);
        
        // Look in the direction the drone is facing
        const lookAtPoint = new THREE.Vector3();
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyEuler(droneState.rotation);
        lookAtPoint.copy(droneState.position).add(forward);
        camera.lookAt(lookAtPoint);
    } else {
        // Normal mode - camera stays above
        camera.position.set(
            droneState.position.x,
            droneState.position.y + 2,
            droneState.position.z
        );

    }
  
  
   

    // Check for ring collisions and update timer
    rings.forEach((ring, i) => {
        if (ring.visible) {  // Only check visible rings
            const distance = droneState.position.distanceTo(ring.position);
            if (distance < 2) {  // If drone is close enough to ring
                ring.visible = false;  // Hide the ring
                ringsCollected++;
                
                if (!timerStarted) {
                    timerStarted = true;
                    startTime = Date.now();
                }
                
                if (ringsCollected === ringCount) {
                    const endTime = Date.now();
                    const totalTime = ((endTime - startTime) / 1000).toFixed(1);
                    document.getElementById('timer').textContent = `Completed in: ${totalTime}s`;
                }
            }
        }
    });

    // Update timer if race is in progress
    if (timerStarted && ringsCollected < ringCount) {
        const currentTime = ((Date.now() - startTime) / 1000).toFixed(1);
        document.getElementById('timer').textContent = `Time: ${currentTime}s`;
    }

    // Animate remaining rings
    rings.forEach((ring, i) => {
        if (ring.visible) {
            ring.rotation.y += 0.01;
            ring.position.y += Math.sin(Date.now() * 0.001 + i) * 0.02;
        }
    });

    renderer.render(scene, camera);
}

// Handle window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate(); 
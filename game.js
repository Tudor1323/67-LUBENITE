// Three.js Scene Setup
let scene, camera, renderer;
let gameState = {
    score: 0,
    kills: 0,
    deaths: 0,
    round: 1,
    highScore: localStorage.getItem('doomHighScore') || 0
};


const player = {
    health: 100,
    maxHealth: 100,
    speed: 0.15,
    ammo: 30,
    maxAmmo: 30,
    weapon: 'pistol',
    shootCooldown: 0,
    reloadTime: 0,
    reloadDuration: 0,
    isReloading: false
};


const weapons = {
    pistol: { damage: 15, fireRate: 8, ammo: 30, maxAmmo: 120, range: 100, reloadTime: 30, name: 'Pistol' },
    rifle: { damage: 25, fireRate: 12, ammo: 20, maxAmmo: 120, range: 200, reloadTime: 40, name: 'Rifle' },
    shotgun: { damage: 50, fireRate: 20, ammo: 8, maxAmmo: 32, range: 80, reloadTime: 50, name: 'Shotgun' },
    sniper: { damage: 100, fireRate: 30, ammo: 5, maxAmmo: 50, range: 500, reloadTime: 60, name: 'Sniper' }
};

let enemies = [];
let raycaster = new THREE.Raycaster();
let raycasterHit = new THREE.Vector3();
let keys = {};
let mouseX = 0, mouseY = 0;
let rightMouseDown = false;
let currentWeaponModel = null;

// Initialize Three.js
function initThreeJS() {
    const canvas = document.getElementById('gameCanvas');
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a0a00);
    scene.fog = new THREE.Fog(0x1a0a00, 300, 500);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 10);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth - 300, window.innerHeight);
    renderer.shadowMap.enabled = true;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x8a4c1a, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xff4400, 0.8);
    directionalLight.position.set(100, 100, 100);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -200;
    directionalLight.shadow.camera.right = 200;
    directionalLight.shadow.camera.top = 200;
    directionalLight.shadow.camera.bottom = -200;
    scene.add(directionalLight);

    // Create environment
    createLevel();
    createWeaponModel();
    spawnEnemies(5);

    // Event listeners
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('click', onMouseClick);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('resize', onWindowResize);
}

function createLevel() {
    // Floor
    const floorGeometry = new THREE.PlaneGeometry(400, 400);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x2a1a0a,
        roughness: 0.9,
        metalness: 0
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Ceiling
    const ceilingGeometry = new THREE.PlaneGeometry(400, 400);
    const ceilingMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x1a1a1a,
        roughness: 0.9,
        metalness: 0
    });
    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.position.y = 50;
    ceiling.rotation.x = Math.PI / 2;
    ceiling.receiveShadow = true;
    scene.add(ceiling);

    // Create maze-like walls
    const walls = [
        { x: 0, y: 25, z: -200, w: 400, h: 50, d: 1 },
        { x: 0, y: 25, z: 200, w: 400, h: 50, d: 1 },
        { x: -200, y: 25, z: 0, w: 1, h: 50, d: 400 },
        { x: 200, y: 25, z: 0, w: 1, h: 50, d: 400 },
        
        // Inner walls for maze
        { x: -100, y: 25, z: -100, w: 1, h: 50, d: 100 },
        { x: 100, y: 25, z: 100, w: 1, h: 50, d: 100 },
        { x: -50, y: 25, z: 50, w: 150, h: 50, d: 1 },
        { x: 50, y: 25, z: -50, w: 150, h: 50, d: 1 },
    ];

    walls.forEach(wallConfig => {
        const wallGeometry = new THREE.BoxGeometry(wallConfig.w, wallConfig.h, wallConfig.d);
        const wallMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x4a3a2a,
            roughness: 0.8,
            metalness: 0
        });
        const wall = new THREE.Mesh(wallGeometry, wallMaterial);
        wall.position.set(wallConfig.x, wallConfig.y, wallConfig.z);
        wall.castShadow = true;
        wall.receiveShadow = true;
        scene.add(wall);
    });
}

class HumanEnemy {
    constructor(x, z) {
        this.position = new THREE.Vector3(x, 0, z);
        this.health = 60;
        this.maxHealth = 60;
        this.speed = 0.08;
        this.shootCooldown = 0;
        this.detectionRange = 150;
        this.shootRange = 120;
        this.model = this.createModel();
        scene.add(this.model);
    }

    createModel() {
        const group = new THREE.Group();
        group.position.copy(this.position);

        // Body
        const bodyGeometry = new THREE.BoxGeometry(2, 4, 2);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x8b4513,
            metalness: 0.1,
            roughness: 0.8
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 2;
        body.castShadow = true;
        group.add(body);

        // Head
        const headGeometry = new THREE.SphereGeometry(1.2, 8, 8);
        const headMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xd4a373,
            metalness: 0.05,
            roughness: 0.9
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 5;
        head.castShadow = true;
        group.add(head);

        // Left arm
        const armGeometry = new THREE.BoxGeometry(1, 4, 1);
        const armMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xd4a373,
            metalness: 0.05,
            roughness: 0.9
        });
        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(-2, 3, 0);
        leftArm.castShadow = true;
        group.add(leftArm);

        // Right arm with weapon
        const rightArm = new THREE.Mesh(armGeometry, armMaterial);
        rightArm.position.set(2, 3, 0);
        rightArm.castShadow = true;
        group.add(rightArm);

        // Gun in hand
        const gunGeometry = new THREE.BoxGeometry(0.5, 0.5, 2);
        const gunMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x1a1a1a,
            metalness: 0.8,
            roughness: 0.2
        });
        const gun = new THREE.Mesh(gunGeometry, gunMaterial);
        gun.position.set(3, 3, -1);
        gun.castShadow = true;
        group.add(gun);

        return group;
    }

    update() {
        const dx = camera.position.x - this.position.x;
        const dz = camera.position.z - this.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance < this.detectionRange) {
            const dirX = dx / distance;
            const dirZ = dz / distance;

            if (distance > this.shootRange) {
                this.position.x += dirX * this.speed;
                this.position.z += dirZ * this.speed;
            }

            this.shootCooldown--;
            if (this.shootCooldown <= 0 && distance < this.shootRange) {
                this.shoot();
                this.shootCooldown = 60;
            }
        }

        this.model.position.copy(this.position);
    }

    shoot() {
        const direction = new THREE.Vector3();
        direction.subVectors(camera.position, this.position).normalize();
        
        const damage = 5;
        player.health -= damage;
        updateMessage(`Hit! -${damage}HP`);
    }

    takeDamage(amount) {
        this.health -= amount;
    }

    remove() {
        scene.remove(this.model);
    }
}

function spawnEnemies(count) {
    enemies.forEach(enemy => enemy.remove());
    enemies = [];

    for (let i = 0; i < count; i++) {
        let x, z, distance;
        do {
            x = (Math.random() - 0.5) * 300;
            z = (Math.random() - 0.5) * 300;
            distance = Math.sqrt(x * x + z * z);
        } while (distance < 60 || distance > 180);

        enemies.push(new HumanEnemy(x, z));
    }
}

function createWeaponModel() {
    if (currentWeaponModel) camera.remove(currentWeaponModel);

    const weaponGroup = new THREE.Group();
    const weapon = weapons[player.weapon];

    // Weapon barrel
    const barrelGeometry = new THREE.CylinderGeometry(1.5, 1.5, 8, 16);
    const barrelMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x1a1a1a,
        metalness: 0.8,
        roughness: 0.2
    });
    const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
    barrel.position.set(4, -2, -10);
    barrel.rotation.z = Math.PI / 2;
    barrel.castShadow = true;
    weaponGroup.add(barrel);

    // Weapon stock
    const stockGeometry = new THREE.BoxGeometry(2, 2, 4);
    const stockMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x8b4513,
        metalness: 0.2,
        roughness: 0.7
    });
    const stock = new THREE.Mesh(stockGeometry, stockMaterial);
    stock.position.set(0, -3, -8);
    stock.castShadow = true;
    weaponGroup.add(stock);

    // Weapon magazine
    const magGeometry = new THREE.BoxGeometry(1.2, 3, 1);
    const magMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x2a2a2a,
        metalness: 0.6,
        roughness: 0.4
    });
    const magazine = new THREE.Mesh(magGeometry, magMaterial);
    magazine.position.set(2, -4, -6);
    magazine.castShadow = true;
    weaponGroup.add(magazine);

    weaponGroup.position.set(8, -5, -15);
    camera.add(weaponGroup);
    currentWeaponModel = weaponGroup;
}

function shoot() {
    if (player.shootCooldown > 0 || player.ammo <= 0 || player.isReloading) return;

    const weapon = weapons[player.weapon];
    player.ammo--;
    player.shootCooldown = weapon.fireRate;

    // Recoil animation
    if (currentWeaponModel) {
        currentWeaponModel.position.z -= 1;
        setTimeout(() => {
            if (currentWeaponModel) currentWeaponModel.position.z += 1;
        }, 50);
    }

    // Cast ray
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    for (let intersect of intersects) {
        // Check if we hit an enemy
        for (let enemy of enemies) {
            if (intersect.object.parent === enemy.model || intersect.object === enemy.model) {
                enemy.takeDamage(weapon.damage);
                updateMessage(`Hit! +${weapon.damage} damage`);

                if (enemy.health <= 0) {
                    enemy.remove();
                    enemies.splice(enemies.indexOf(enemy), 1);
                    gameState.kills++;
                    gameState.score += 100;
                    updateMessage(`KILL! +100 score`);
                }
                return;
            }
        }

        // Stop at walls
        if (intersect.distance < weapon.range) {
            return;
        }
    }
}

function reload() {
    if (player.isReloading || player.ammo === player.maxAmmo) return;

    const weapon = weapons[player.weapon];
    player.isReloading = true;
    player.reloadTime = weapon.reloadTime;
    player.reloadDuration = weapon.reloadTime;

    document.getElementById('reloadIndicator').style.display = 'block';
    updateMessage(`Reloading ${weapon.name}...`);
}

function switchWeapon(weapon) {
    if (player.weapon === weapon || player.isReloading) return;
    
    weapons[player.weapon].ammo = player.ammo;
    player.weapon = weapon;
    player.ammo = weapons[weapon].ammo;
    player.shootCooldown = 0;
    player.isReloading = false;
    player.reloadTime = 0;
    document.getElementById('reloadIndicator').style.display = 'none';
    
    document.querySelectorAll('.weapon-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.weapon === weapon) {
            btn.classList.add('active');
        }
    });
    
    createWeaponModel();
    updateMessage(`Switched to ${weapons[weapon].name}`);
}

function nextRound() {
    gameState.round++;
    const enemyCount = Math.min(5 + gameState.round, 12);
    spawnEnemies(enemyCount);
    player.health = player.maxHealth;
    player.ammo = weapons[player.weapon].maxAmmo;
    updateMessage(`Round ${gameState.round} - ${enemyCount} enemies!`);
}

function gameOver() {
    gameState.deaths++;
    player.health = player.maxHealth;
    
    if (gameState.score > gameState.highScore) {
        gameState.highScore = gameState.score;
        localStorage.setItem('doomHighScore', gameState.highScore);
    }
    
    gameState.round = 1;
    gameState.kills = 0;
    gameState.score = 0;
    spawnEnemies(5);
    updateMessage('YOU DIED! Game reset.');
}

function updateMessage(msg) {
    document.getElementById('message').textContent = msg;
}

function updateUI() {
    document.getElementById('kills').textContent = gameState.kills;
    document.getElementById('deaths').textContent = gameState.deaths;
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('hp').textContent = Math.max(0, Math.floor(player.health));
    document.getElementById('ammo').textContent = player.ammo;
    document.getElementById('round').textContent = gameState.round;
    document.getElementById('enemyCount').textContent = enemies.length;
    document.getElementById('highScore').textContent = gameState.highScore;

    const healthPercent = (player.health / player.maxHealth) * 100;
    document.getElementById('healthFill').style.width = healthPercent + '%';

    const weapon = weapons[player.weapon];
    const ammoPercent = (player.ammo / weapon.maxAmmo) * 100;
    document.getElementById('ammoFill').style.width = ammoPercent + '%';

    if (player.isReloading) {
        const reloadPercent = ((player.reloadDuration - player.reloadTime) / player.reloadDuration) * 100;
        document.getElementById('reloadFill').style.width = reloadPercent + '%';
    }
}

function update() {
    // Player movement
    const moveSpeed = 0.3;
    if (keys['w'] || keys['W']) camera.position.z -= moveSpeed;
    if (keys['s'] || keys['S']) camera.position.z += moveSpeed;
    if (keys['a'] || keys['A']) camera.position.x -= moveSpeed;
    if (keys['d'] || keys['D']) camera.position.x += moveSpeed;

    // Clamp player position to level bounds
    camera.position.x = Math.max(-190, Math.min(190, camera.position.x));
    camera.position.z = Math.max(-190, Math.min(190, camera.position.z));
    camera.position.y = 5;

    // Cooldowns
    player.shootCooldown = Math.max(0, player.shootCooldown - 1);

    // Reload
    if (player.isReloading) {
        player.reloadTime--;
        if (player.reloadTime <= 0) {
            player.ammo = weapons[player.weapon].maxAmmo;
            player.isReloading = false;
            document.getElementById('reloadIndicator').style.display = 'none';
            updateMessage('Reload complete!');
        }
    }

    // Update enemies
    enemies.forEach(enemy => enemy.update());

    // Check if round complete
    if (enemies.length === 0 && gameState.round > 0) {
        nextRound();
    }

    // Check if dead
    if (player.health <= 0) {
        gameOver();
    }
}

function onKeyDown(e) {
    keys[e.key] = true;

    if (e.key === '1') switchWeapon('pistol');
    if (e.key === '2') switchWeapon('rifle');
    if (e.key === '3') switchWeapon('shotgun');
    if (e.key === '4') switchWeapon('sniper');
    if (e.key === 'r' || e.key === 'R') reload();
    if (e.key === 'Escape') {
        document.exitPointerLock = document.exitPointerLock || document.mozExitPointerLock;
        document.exitPointerLock();
    }
}

function onKeyUp(e) {
    keys[e.key] = false;
}

function onMouseClick(e) {
    if (e.button === 0) {
        shoot();
    }
}

function onMouseMove(e) {
    if (!rightMouseDown) return;

    const movementX = e.movementX || e.mozMovementX || 0;
    const movementY = e.movementY || e.mozMovementY || 0;

    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.setFromQuaternion(camera.quaternion);

    euler.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -movementX * 0.005);
    euler.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), -movementY * 0.005);

    camera.quaternion.setFromEuler(euler);
}

function onMouseDown(e) {
    if (e.button === 2) {
        rightMouseDown = true;
    }
}

function onMouseUp(e) {
    if (e.button === 2) {
        rightMouseDown = false;
    }
}

function onWindowResize() {
    const canvas = document.getElementById('gameCanvas');
    camera.aspect = (window.innerWidth - 300) / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth - 300, window.innerHeight);
}

function gameLoop() {
    requestAnimationFrame(gameLoop);
    update();
    updateUI();
    renderer.render(scene, camera);
}

// Start game
window.addEventListener('DOMContentLoaded', () => {
    initThreeJS();
    gameLoop();
    updateMessage('Welcome to DOOM-3D! Use WASD to move, RIGHT CLICK to look, LEFT CLICK to shoot, R to reload!');
});

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const weapon = document.getElementById("weapon");

// Configurando e injetando a nova HUD dinâmica via script
const screenWrapper = document.querySelector(".screen-wrapper");
const damageFlash = document.createElement("div");
damageFlash.className = "damage-flash";
screenWrapper.appendChild(damageFlash);

const hudPanel = document.createElement("div");
hudPanel.className = "hud-panel";
hudPanel.innerHTML = `
    <div class="hud-stat"><div class="hud-label">NÍVEL</div><div id="hud-level" class="hud-value blue">1</div></div>
    <div class="hud-stat"><div class="hud-label">SAÚDE</div><div id="hud-hp" class="hud-value">100%</div></div>
    <div class="hud-stat"><div class="hud-label">MUNIÇÃO</div><div id="hud-ammo" class="hud-value">10/10</div></div>
    <div class="hud-stat"><div class="hud-label">RESTANTES</div><div id="hud-remaining" class="hud-value">0</div></div>
`;
document.querySelector(".game-container").insertBefore(hudPanel, document.querySelector(".controls-hint"));

const hudLevel = document.getElementById("hud-level");
const hudHp = document.getElementById("hud-hp");
const hudAmmo = document.getElementById("hud-ammo");
const hudRemaining = document.getElementById("hud-remaining");

// CONFIGURAÇÕES DA ENGINE MATRIZ DO LABIRINTO (1 = Parede, 0 = Vazio)
const mapWidth = 14;
const mapHeight = 14;
const map =;

// Estado do Jogador
let player = {
    x: 2.5,
    y: 2.5,
    angle: 0,
    hp: 100,
    maxAmmo: 10,
    ammo: 10,
    isReloading: false,
    level: 1
};

// Configurações Matemáticas de Projeção Raycasting 3D
const FOV = Math.PI / 3; 
const halfFOV = FOV / 2;
const numRays = canvas.width;
const deltaAngle = FOV / numRays;
const renderDistance = 16;
let zBuffer = new Array(canvas.width);

// Listas Globais de Entidades Ativas
let enemies = [];
let projectiles = []; // Projéteis no ar
let items = [];       // Coletáveis (Medkits, Ammo boxes)

// Configurações de Entrada de Controles
const moveSpeed = 0.055;
const rotSpeed = 0.038;
let keys = {};
document.addEventListener("keydown", e => keys[e.code] = true);
document.addEventListener("keyup", e => keys[e.code] = false);

// Disparar projétil balístico real na direção da visão
document.addEventListener("mousedown", () => {
    if (player.hp <= 0 || player.isReloading) return;

    if (player.ammo <= 0) {
        reloadWeapon();
        return;
    }

    if (!weapon.classList.contains("shoot-animation")) {
        weapon.classList.add("shoot-animation");
        player.ammo--;
        updateHUD();
        
        setTimeout(() => weapon.classList.remove("shoot-animation"), 100);

        // Criar o Objeto do Projétil do Jogador
        projectiles.push({
            x: player.x,
            y: player.y,
            vx: Math.cos(player.angle) * 0.22,
            vy: Math.sin(player.angle) * 0.22,
            isEnemy: false,
            radius: 0.1
        });
    }
});

function reloadWeapon() {
    player.isReloading = true;
    hudAmmo.innerText = "RELOAD...";
    hudAmmo.className = "hud-value low";
    
    setTimeout(() => {
        player.ammo = player.maxAmmo;
        player.isReloading = false;
        hudAmmo.className = "hud-value";
        updateHUD();
    }, 1000);
}

function triggerDamageFlash() {
    damageFlash.style.opacity = "1";
    setTimeout(() => damageFlash.style.opacity = "0", 60);
}

function updateHUD() {
    hudLevel.innerText = player.level;
    hudHp.innerText = `${player.hp}%`;
    hudHp.className = player.hp <= 30 ? "hud-value low" : "hud-value";
    
    if (!player.isReloading) {
        hudAmmo.innerText = `${player.ammo}/${player.maxAmmo}`;
        hudAmmo.className = player.ammo === 0 ? "hud-value low" : "hud-value";
    }
    hudRemaining.innerText = enemies.length;
}

// Inicializador de Nível (Spawna monstros com dificuldade incremental)
function initLevel() {
    enemies = [];
    projectiles = [];
    items = [];

    // Gerar Inimigos com base no nível atual
    let baseEnemyCount = 3 + player.level;
    for (let i = 0; i < baseEnemyCount; i++) {
        let coords = getFreeCoords();
        // Alterna entre Inimigo Comum (Patrulheiro) e Inimigo Lançador (Atira projéteis)
        let isShooter = i % 2 === 1 && player.level > 1; 
        enemies.push({
            x: coords.x,
            y: coords.y,
            hp: isShooter ? 2 : 3,
            maxHp: isShooter ? 2 : 3,
            speed: isShooter ? 0.015 : 0.02 + (player.level * 0.003),
            type: isShooter ? "SHOOTER" : "MELEE",
            radius: 0.25,
            lastShotTime: 0,
            color: isShooter ? "#ff33ff" : "#ffcc00" // Roxo (Atirador) vs Amarelo (Guerreiro)
        });
    }

    // Gerar Coletáveis no Mapa (Sempre um Medkit e uma Munição por nível)
    let medkitPos = getFreeCoords();
    items.push({ x: medkitPos.x, y: medkitPos.y, type: "MEDKIT", color: "#00ff88", radius: 0.2 });
    
    let ammoPos = getFreeCoords();
    items.push({ x: ammoPos.x, y: ammoPos.y, type: "AMMO", color: "#00e5ff", radius: 0.2 });

    updateHUD();
}

function getFreeCoords() {
    let rx, ry;
    do {
        rx = Math.floor(Math.random() * (mapWidth - 2)) + 1;
        ry = Math.floor(Math.random() * (mapHeight - 2)) + 1;
    } while (map[ry * mapWidth + rx] === 1 || (Math.abs(rx - player.x) < 2 && Math.abs(ry - player.y) < 2));
    return { x: rx + 0.5, y: ry + 0.5 };
}

// Loop de Física, Atualizações de IA e Colisões Matriciais
function update() {
    if (player.hp <= 0) return;

    // Passar de Nível se todos os inimigos morrerem
    if (enemies.length === 0) {
        player.level++;
        player.hp = Math.min(100, player.hp + 20); // Bônus de cura ao passar de fase
        initLevel();
        return;
    }

    // Movimentação do Jogador
    let newX = player.x;
    let newY = player.y;
    if (keys["KeyW"] || keys["ArrowUp"]) {
        newX += Math.cos(player.angle) * moveSpeed;
        newY += Math.sin(player.angle) * moveSpeed;
    }
    if (keys["KeyS"] || keys["ArrowDown"]) {
        newX -= Math.cos(player.angle) * moveSpeed;
        newY -= Math.sin(player.angle) * moveSpeed;
    }
    if (keys["KeyA"] || keys["ArrowLeft"])  player.angle -= rotSpeed;
    if (keys["KeyD"] || keys["ArrowRight"]) player.angle += rotSpeed;

    // Colisão do jogador contra as Paredes
    if (map[Math.floor(player.y) * mapWidth + Math.floor(newX)] === 0) player.x = newX;
    if (map[Math.floor(newY) * mapWidth + Math.floor(player.x)] === 0) player.y = newY;

    // LÓGICA DOS PROJÉTEIS (FÍSICA)
    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        p.x += p.vx;
        p.y += p.vy;

        // Se o projétil colidir na parede, é destruído
        if (map[Math.floor(p.y) * mapWidth + Math.floor(p.x)] === 1) {
            projectiles.splice(i, 1);
            continue;
        }

        if (!p.isEnemy) {
            // Projétil do Jogador -> Verifica colisão contra os Inimigos
            for (let j = enemies.length - 1; j >= 0; j--) {
                let e = enemies[j];
                let dist = Math.sqrt((p.x - e.x)**2 + (p.y - e.y)**2);
                if (dist < e.radius) {
                    e.hp--;
                    projectiles.splice(i, 1);
                    if (e.hp <= 0) {
                        enemies.splice(j, 1);
                        updateHUD();
                    }
                    break;
                }
            }
        } else {
            // Projétil do Inimigo -> Verifica colisão contra o Jogador
            let distToPlayer = Math.sqrt((p.x - player.x)**2 + (p.y - player.y)**2);
            if (distToPlayer < 0.3) {
                player.hp = Math.max(0, player.hp - 15); // Dano pesado de tiro
                projectiles.splice(i, 1);
                updateHUD();
                triggerDamageFlash();
            }
        }
    }

    // LÓGICA E IA DOS INIMIGOS
    enemies.forEach(e => {
        let dx = player.x - e.x;
        let dy = player.y - e.y;
        let dist = Math.sqrt(dx * dx + dy * dy);

        // Perseguição
        if (dist > 0.4) {
            e.x += (dx / dist) * e.speed;
            e.y += (dy / dist) * e.speed;

            // Se for do tipo ATIRADOR (SHOOTER), ele dispara projéteis esporadicamente à distância
            if (e.type === "SHOOTER" && dist < 7 && Math.random() < 0.015) {
                projectiles.push({
                    x: e.x,
                    y: e.y,
                    vx: (dx / dist) * 0.1,
                    vy: (dy / dist) * 0.1,
                    isEnemy: true,
                    radius: 0.08,
                    color: "#ff33ff"
                });
            }
        } else if (e.type === "MELEE") {
            // Se for inimigo comum e encostar, morde por segundo
            player.hp = Math.max(0, player.hp - 1);
            updateHUD();
            triggerDamageFlash();
        }
    });

    // COLETAR ITENS DO CHÃO
    for (let i = items.length - 1; i >= 0; i--) {
        let it = items[i];
        let dist = Math.sqrt((player.x - it.x)**2 + (player.y - it.y)**2);
        if (dist < 0.4) {
            if (it.type === "MEDKIT") {
                player.hp = Math.min(100, player.hp + 40);
            } else if (it.type === "AMMO") {
                player.ammo = player.maxAmmo;
            }
            items.splice(i, 1);
            updateHUD();
        }
    }
}

// RENDERIZADOR GRÁFICO CORE RAYCASTING DE CENÁRIOS E SPRITES ENTIDADES
function draw() {
    // Teto e Chão Ambientais
    ctx.fillStyle = "#111116"; ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
    ctx.fillStyle = "#251e1a"; ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);

    // 1. RENDERIZAR AS PAREDES 3D E COLETAR DADOS DO Z-BUFFER
    let startAngle = player.angle - halfFOV;
    for (let i = 0; i < numRays; i++) {
        let rayAngle = startAngle + i * deltaAngle;
let distance = 0; let hitWall = false;
let eyeX = Math.cos(rayAngle); let eyeY = Math.sin(rayAngle);
while (!hitWall && distance < renderDistance) {
distance += 0.04;
let testX = Math.floor(player.x + eyeX * distance);
let testY = Math.floor(player.y + eyeY * distance);
if (testX < 0 || testX >= mapWidth || testY < 0 || testY >= mapHeight || map[testY * mapWidth + testX] === 1) {
hitWall = true;
}
}
let correctedDistance = distance * Math.cos(rayAngle - player.angle);
if (correctedDistance < 0.1) correctedDistance = 0.1;
zBuffer[i] = correctedDistance; // Salva profundidade da parede
let wallHeight = Math.min(canvas.height, (canvas.height / correctedDistance));
let shade = Math.max(0, 180 - (correctedDistance * 12));
ctx.strokeStyle = rgb(${shade}, 0, 0);
ctx.lineWidth = 1;
ctx.beginPath(); ctx.moveTo(i, (canvas.height - wallHeight) / 2); ctx.lineTo(i, (canvas.height + wallHeight) / 2); ctx.stroke();
}
// Unificar Entidades (Inimigos, Projéteis e Itens) para renderização matricial ordenada por distância
let spriteQueue = [];
enemies.forEach(e => spriteQueue.push({x: e.x, y: e.y, color: e.color, type: "ENEMY", enemyType: e.type, hp: e.hp, maxHp: e.maxHp, radius: e.radius}));
projectiles.forEach(p => spriteQueue.push({x: p.x, y: p.y, color: p.isEnemy ? "#ff00ff" : "#ffff00", type: "PROJECTILE", radius: p.radius}));
items.forEach(it => spriteQueue.push({x: it.x, y: it.y, color: it.color, type: "ITEM", itemType: it.type, radius: it.radius}));
// Ordenar de trás para frente para evitar sobreposições incorretas (Algoritmo do Pintor)
spriteQueue.sort((a, b) => {
let distA = (a.x - player.x)**2 + (a.y - player.y)**2;
let distB = (b.x - player.x)**2 + (b.y - player.y)**2;
return distB - distA;
});
// 2. PROJETAR TODAS AS ENTIDADES DO MAPA EM PERSPECTIVA 3D
spriteQueue.forEach(s => {
let ex = s.x - player.x; let ey = s.y - player.y;
let spriteX = ex * Math.sin(player.angle) - ey * Math.cos(player.angle);
let spriteY = ex * Math.cos(player.angle) + ey * Math.sin(player.angle);
if (spriteY <= 0.1) return; // Atrás da câmera
let spriteScreenX = parseInt((canvas.width / 2) * (1 + spriteX / spriteY));
let spriteSize = Math.abs(parseInt(canvas.height / spriteY));
if (s.type === "PROJECTILE") spriteSize = Math.abs(parseInt(canvas.height / (spriteY * 3.5))); // Projéteis menores
if (s.type === "ITEM") spriteSize = Math.abs(parseInt(canvas.height / (spriteY * 1.8)));
let drawStartX = parseInt(spriteScreenX - spriteSize / 2);
let drawEndX = parseInt(spriteScreenX + spriteSize / 2);
let drawStartY = parseInt((canvas.height - spriteSize) / 2);
if (s.type === "ITEM") drawStartY = parseInt((canvas.height / 2) + (spriteSize / 2)); // Coloca itens no chão
for (let stripe = drawStartX; stripe < drawEndX; stripe++) {
if (stripe >= 0 && stripe < canvas.width && spriteY < zBuffer[stripe]) {
ctx.strokeStyle = s.color;
ctx.lineWidth = 1;
ctx.beginPath();
ctx.moveTo(stripe, drawStartY);
ctx.lineTo(stripe, drawStartY + spriteSize);
ctx.stroke();
// Customização visual rápida de detalhes por colunas
if (s.type === "ENEMY" && stripe === parseInt((drawStartX + drawEndX)/2)) {
// Barra de Vida flutuante em cima da cabeça do Monstro
ctx.fillStyle = "#ff0000"; ctx.fillRect(drawStartX, drawStartY - 10, spriteSize, 3);
ctx.fillStyle = "#00ff00"; ctx.fillRect(drawStartX, drawStartY - 10, spriteSize * (s.hp / s.maxHp), 3);
}
}
}
});
// 3. MINIMAPA 2D NO CANTO DA TELA
const minMapScale = 4;
for (let y = 0; y < mapHeight; y++) {
for (let x = 0; x < mapWidth; x++) {
if (map[y * mapWidth + x] === 1) {
ctx.fillStyle = "#440000"; ctx.fillRect(x * minMapScale + 10, y * minMapScale + 10, minMapScale, minMapScale);
}
}
}
// Renderizar pontos de entidades no minimapa
ctx.fillStyle = "#00ff00"; ctx.fillRect(player.x * minMapScale + 10, player.y * minMapScale + 10, 3, 3); // Player
enemies.forEach(e => { ctx.fillStyle = e.color; ctx.fillRect(e.x * minMapScale + 10, e.y * minMapScale + 10, 2, 2); });
items.forEach(it => { ctx.fillStyle = it.color; ctx.fillRect(it.x * minMapScale + 10, it.y * minMapScale + 10, 2, 2); });
// Tela de Fim de Jogo
if (player.hp <= 0) {
ctx.fillStyle = "rgba(0, 0, 0, 0.9)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = "#ff0000"; ctx.font = "bold 36px 'Courier New'"; ctx.textAlign = "center";
ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 10);
ctx.fillStyle = "#fff"; ctx.font = "16px 'Courier New'";
ctx.fillText(Você sucumbiu no Nível ${player.level}, canvas.width / 2, canvas.height / 2 + 30);
ctx.fillText("Pressione F5 para reiniciar os sistemas", canvas.width / 2, canvas.height / 2 + 60);
}
}
function gameLoop() {
update();
draw();
requestAnimationFrame(gameLoop);
}
// Inicializar o primeiro nível da campanha
initLevel();
gameLoop();

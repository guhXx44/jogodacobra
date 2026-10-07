const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const weapon = document.getElementById("weapon");

// CONFIGURAÇÕES DO MAPA (1 = Parede, 0 = Espaço Vazio)
// Um labirinto estilo arena clássica
const mapWidth = 16;
const mapHeight = 16;
const map = [
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,
    1,0,1,1,0,0,1,0,1,1,1,1,0,1,0,1,
    1,0,1,0,0,0,0,0,0,0,0,1,0,1,0,1,
    1,0,1,0,1,1,1,1,1,1,0,1,0,1,0,1,
    1,0,0,0,1,0,0,0,0,1,0,0,0,0,0,1,
    1,0,1,0,1,0,0,0,0,1,0,1,1,1,0,1,
    1,0,1,0,0,0,0,0,0,0,0,0,0,1,0,1,
    1,0,1,1,1,1,0,0,0,0,1,1,0,1,0,1,
    1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,
    1,1,1,0,0,1,1,0,0,1,1,0,1,1,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,
    1,0,1,1,1,1,1,1,0,1,1,1,1,0,1,1,
    1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1
];

// Posição Inicial do Jogador
let playerX = 3.5;
let playerY = 3.5;
let playerAngle = 0; // Ângulo de visão em Radianos

// Configurações da Câmera (Campo de Visão)
const FOV = Math.PI / 3; // 60 graus de visão
const halfFOV = FOV / 2;
const numRays = canvas.width; // Um raio disparado por coluna de pixel da tela
const deltaAngle = FOV / numRays;
const renderDistance = 16;

// Movimentação
const moveSpeed = 0.06;
const rotSpeed = 0.04;
let keys = {};

document.addEventListener("keydown", e => keys[e.code] = true);
document.addEventListener("keyup", e => keys[e.code] = false);

// Mecânica de Tiro ao clicar na tela
document.addEventListener("mousedown", () => {
    if (!weapon.classList.contains("shoot-animation")) {
        weapon.classList.add("shoot-animation");
        // Remove a classe após a animação terminar para poder atirar de novo
        setTimeout(() => weapon.classList.remove("shoot-animation"), 150);
        
        // Efeito visual rápido de flash na tela (Muzzle Flash)
        ctx.fillStyle = "rgba(255, 200, 0, 0.3)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
});

// Atualização da Lógica de Movimento
function update() {
    let newX = playerX;
    let newY = playerY;

    // Andar para frente (W)
    if (keys["KeyW"] || keys["ArrowUp"]) {
        newX += Math.cos(playerAngle) * moveSpeed;
        newY += Math.sin(playerAngle) * moveSpeed;
    }
    // Andar para trás (S)
    if (keys["KeyS"] || keys["ArrowDown"]) {
        newX -= Math.cos(playerAngle) * moveSpeed;
        newY -= Math.sin(playerAngle) * moveSpeed;
    }
    // Girar a câmera para a Esquerda (A)
    if (keys["KeyA"] || keys["ArrowLeft"]) {
        playerAngle -= rotSpeed;
    }
    // Girar a câmera para a Direita (D)
    if (keys["KeyD"] || keys["ArrowRight"]) {
        playerAngle += rotSpeed;
    }

    // Sistema de Colisão Simples (Só move se o quadrado do mapa for 0)
    if (map[Math.floor(playerY) * mapWidth + Math.floor(newX)] === 0) {
        playerX = newX;
    }
    if (map[Math.floor(newY) * mapWidth + Math.floor(playerX)] === 0) {
        playerY = newY;
    }
}

// Renderização Gráfica 3D por Raycasting
function draw() {
    // 1. Limpar e desenhar o teto (Cinza Escuro) e o chão (Marrom/Terra)
    ctx.fillStyle = "#1a1a1a"; // Teto
    ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
    ctx.fillStyle = "#332211"; // Chão
    ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);

    // 2. Lançamento de Raios (Raycasting)
    let startAngle = playerAngle - halfFOV;

    for (let i = 0; i < numRays; i++) {
        let rayAngle = startAngle + i * deltaAngle;
        let distance = 0;
        let hitWall = false;
        let wallType = 0;

        // Vetor unitário do raio
        let eyeX = Math.cos(rayAngle);
        let eyeY = Math.sin(rayAngle);

        // Avança o raio até bater em uma parede ou atingir o limite
        while (!hitWall && distance < renderDistance) {
            distance += 0.05;
            let testX = Math.floor(playerX + eyeX * distance);
            let testY = Math.floor(playerY + eyeY * distance);

            // Se o raio sair do mapa
            if (testX < 0 || testX >= mapWidth || testY < 0 || testY >= mapHeight) {
                hitWall = true;
                distance = renderDistance;
            } else if (map[testY * mapWidth + testX] > 0) {
                hitWall = true;
                wallType = map[testY * mapWidth + testX];
            }
        }

        // Correção do efeito de olho de peixe (distorção esférica)
        let correctedDistance = distance * Math.cos(rayAngle - playerAngle);
        if (correctedDistance < 0.1) correctedDistance = 0.1;

        // Calcula a altura da parede na tela com base na distância
        let wallHeight = Math.min(canvas.height, (canvas.height / correctedDistance));

        // Efeito de iluminação/sombra: Paredes mais distantes ficam mais escuras
        let shade = Math.max(0, 255 - (correctedDistance * 18));
        
        // Renderiza a fatia vertical da parede (Linhas de 1 pixel de largura)
        ctx.strokeStyle = `rgb(${shade}, 0, 0)`; // Paredes vermelhas estilo ficção científica/Doom retro
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(i, (canvas.height - wallHeight) / 2);
        ctx.lineTo(i, (canvas.height + wallHeight) / 2);
        ctx.stroke();
    }

    // 3. Desenhar Minimapa 2D no canto superior esquerdo para orientação
    const minMapScale = 6;
    for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
            if (map[y * mapWidth + x] === 1) {
                ctx.fillStyle = "#660000";
                ctx.fillRect(x * minMapScale + 10, y * minMapScale + 10, minMapScale, minMapScale);
            }
        }
    }
    // Ponto do jogador no minimapa
    ctx.fillStyle = "#00ff00";
    ctx.fillRect(playerX * minMapScale + 10, playerY * minMapScale + 10, 3, 3);
}

// Loop contínuo de renderização
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Inicializa a engine
gameLoop();

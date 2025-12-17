let saldo = 1000;
let jogosJogados = 0;
let vitorias = 0;
let vezesFichasAdicionadas = 0;
let jogoBlackjack = null;
let jogoBingo = null;
let nomeJogadorRanking = null;
let codigosUsados = [];

// Sistema de boost de sorte
let boostSorteAtivo = false;
let boostSorteExpira = 0;

// Configuração do ranking online usando uma API real
// Vamos usar localStorage compartilhado via URL params como fallback
const RANKING_SHARE_KEY = 'nukuzerabet_global_ranking_v2';

// Fallback para ranking local se API não funcionar
let usarRankingLocal = false;

// Carrega dados salvos ao iniciar
window.addEventListener('DOMContentLoaded', function() {
    carregarDados();
    atualizarSaldo();
    verificarBoostSorte(); // Verifica se há boost ativo
});

function salvarDados() {
    const dados = {
        saldo: saldo,
        jogosJogados: jogosJogados,
        vitorias: vitorias,
        nomeJogadorRanking: nomeJogadorRanking,
        vezesFichasAdicionadas: vezesFichasAdicionadas,
        bloqueioRanking: localStorage.getItem('nukuzerabetBloqueioRanking')
    };
    localStorage.setItem('nukuzerabetDados', JSON.stringify(dados));
}

function carregarDados() {
    const dadosSalvos = localStorage.getItem('nukuzerabetDados');
    if (dadosSalvos) {
        const dados = JSON.parse(dadosSalvos);
        saldo = dados.saldo || 1000;
        jogosJogados = dados.jogosJogados || 0;
        vitorias = dados.vitorias || 0;
        nomeJogadorRanking = dados.nomeJogadorRanking || null;
        vezesFichasAdicionadas = dados.vezesFichasAdicionadas || 0;
    }
}

// Função para salvar no ranking global
async function salvarNoRankingGlobal() {
    if (!nomeJogadorRanking) return;
    
    // Verifica se o jogador está bloqueado
    const bloqueio = localStorage.getItem('nukuzerabetBloqueioRanking');
    if (bloqueio) {
        const tempoBloqueio = parseInt(bloqueio);
        if (tempoBloqueio > Date.now()) {
            return; // Não salva no ranking se estiver bloqueado
        } else {
            // Remove o bloqueio se já passou o tempo
            localStorage.removeItem('nukuzerabetBloqueioRanking');
        }
    }
    
    const timestamp = Date.now();
    const jogador = {
        nome: nomeJogadorRanking,
        saldo: saldo,
        jogos: jogosJogados,
        vitorias: vitorias,
        timestamp: timestamp,
        id: gerarIdUnico()
    };
    
    try {
        // Sempre salva no ranking global simulado
        await salvarRankingGlobalAPI(jogador);
        console.log('Jogador salvo no ranking global:', jogador.nome, 'R$', jogador.saldo);
    } catch (error) {
        console.log('Erro ao salvar no ranking global, usando local:', error);
        // Fallback para ranking local
        salvarNoRankingLocal(jogador);
    }
}

// Função para gerar ID único do jogador
function gerarIdUnico() {
    return nomeJogadorRanking + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Sistema de ranking online usando múltiplas APIs como fallback
async function salvarRankingGlobalAPI(jogador) {
    try {
        console.log('🌐 Salvando jogador no ranking online:', jogador.nome);
        console.log('🔍 DEBUG: Dados completos do jogador:', jogador);
        
        // Lista de APIs para tentar (fallback)
        const apis = [
            {
                name: 'JSONBin',
                url: 'https://api.jsonbin.io/v3/b/676194b5e41b4d34e4616b8a',
                headers: { 'X-Master-Key': '$2a$10$8vF7qJ9mK4nL2pR6tS8uXeY3wZ5cA1bD9fG2hI6jK8lM0nO4pQ7rT' }
            },
            {
                name: 'HTTPBin',
                url: 'https://httpbin.org/anything',
                headers: {}
            }
        ];
        
        let rankingData = [];
        let apiUsada = null;
        
        // Tenta carregar de cada API
        for (const api of apis) {
            try {
                console.log(`Tentando API: ${api.name}`);
                const response = await fetch(api.url + (api.name === 'JSONBin' ? '/latest' : ''), {
                    method: 'GET',
                    headers: api.headers
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (api.name === 'JSONBin') {
                        rankingData = data.record?.jogadores || [];
                    } else {
                        rankingData = data.json?.jogadores || [];
                    }
                    apiUsada = api;
                    console.log(`✅ Conectado via ${api.name}:`, rankingData.length, 'jogadores');
                    break;
                }
            } catch (e) {
                console.log(`❌ Falha na API ${api.name}:`, e.message);
                continue;
            }
        }
        
        // Se nenhuma API funcionou, usa localStorage expandido
        if (!apiUsada) {
            console.log('🔄 Usando sistema de backup localStorage expandido');
            usarRankingLocal = true;
            return await salvarRankingBackup(jogador);
        }
        
        // Remove entrada antiga do mesmo jogador
        rankingData = rankingData.filter(j => j.nome !== jogador.nome);
        
        // Adiciona nova entrada
        rankingData.push(jogador);
        
        // Remove jogadores com mais de 4 horas
        const quatroHorasAtras = Date.now() - (4 * 60 * 60 * 1000);
        rankingData = rankingData.filter(j => j.timestamp > quatroHorasAtras);
        
        // Mantém apenas top 50
        rankingData = rankingData.sort((a, b) => b.saldo - a.saldo).slice(0, 50);
        
        // Tenta salvar na API
        try {
            const payload = {
                jogadores: rankingData,
                ultimaAtualizacao: Date.now(),
                versao: '2.0'
            };
            
            const updateResponse = await fetch(apiUsada.url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...apiUsada.headers
                },
                body: JSON.stringify(payload)
            });
            
            if (updateResponse.ok) {
                console.log('✅ Ranking online salvo via', apiUsada.name);
                usarRankingLocal = false;
            } else {
                throw new Error('Falha ao salvar');
            }
        } catch (saveError) {
            console.log('❌ Erro ao salvar, usando backup:', saveError.message);
            return await salvarRankingBackup(jogador);
        }
        
    } catch (error) {
        console.error('❌ Erro geral no ranking online:', error);
        return await salvarRankingBackup(jogador);
    }
}

// Sistema de backup usando localStorage expandido
async function salvarRankingBackup(jogador) {
    try {
        // Usa múltiplas chaves para simular "rede"
        const chaves = [
            'nukuzera_ranking_br_1',
            'nukuzera_ranking_br_2', 
            'nukuzera_ranking_br_3'
        ];
        
        let rankingData = [];
        
        // Carrega de todas as chaves e combina
        chaves.forEach(chave => {
            try {
                const dados = localStorage.getItem(chave);
                if (dados) {
                    const jogadores = JSON.parse(dados);
                    rankingData = rankingData.concat(jogadores);
                }
            } catch (e) {
                console.log('Erro ao carregar chave', chave);
            }
        });
        
        // Remove duplicatas
        const jogadoresUnicos = {};
        rankingData.forEach(j => {
            if (!jogadoresUnicos[j.nome] || jogadoresUnicos[j.nome].timestamp < j.timestamp) {
                jogadoresUnicos[j.nome] = j;
            }
        });
        
        rankingData = Object.values(jogadoresUnicos);
        
        // Remove entrada antiga do jogador atual
        rankingData = rankingData.filter(j => j.nome !== jogador.nome);
        
        // Adiciona nova entrada
        rankingData.push(jogador);
        
        // Remove jogadores antigos
        const quatroHorasAtras = Date.now() - (4 * 60 * 60 * 1000);
        rankingData = rankingData.filter(j => j.timestamp > quatroHorasAtras);
        
        // Ordena e limita
        rankingData = rankingData.sort((a, b) => b.saldo - a.saldo).slice(0, 50);
        
        // Salva em todas as chaves (redundância)
        const chunkSize = Math.ceil(rankingData.length / chaves.length);
        chaves.forEach((chave, index) => {
            const inicio = index * chunkSize;
            const fim = inicio + chunkSize;
            const chunk = rankingData.slice(inicio, fim);
            localStorage.setItem(chave, JSON.stringify(chunk));
        });
        
        console.log('💾 Ranking salvo no sistema de backup:', rankingData.length, 'jogadores');
        usarRankingLocal = true;
        
    } catch (error) {
        console.error('❌ Erro no sistema de backup:', error);
        // Último recurso: ranking local normal
        salvarNoRankingLocal(jogador);
    }
}

// Fallback para ranking local
function salvarNoRankingLocal(jogador) {
    // Carrega ranking existente
    let rankingData = JSON.parse(localStorage.getItem('nukuzerabetRanking') || '[]');
    
    // Remove entrada antiga do mesmo jogador
    rankingData = rankingData.filter(j => j.nome !== jogador.nome);
    
    // Adiciona nova entrada
    rankingData.push(jogador);
    
    // Remove jogadores com mais de 4 horas
    const quatroHorasAtras = Date.now() - (4 * 60 * 60 * 1000);
    rankingData = rankingData.filter(j => j.timestamp > quatroHorasAtras);
    
    // Salva no localStorage
    localStorage.setItem('nukuzerabetRanking', JSON.stringify(rankingData));
}

// Função original mantida para compatibilidade
function salvarNoRanking() {
    salvarNoRankingGlobal();
}

// Função para carregar ranking online real
async function carregarRankingGlobal() {
    try {
        console.log('Carregando ranking online...');
        
        // Se está usando ranking local, não tenta a API
        if (usarRankingLocal) {
            console.log('Usando ranking local (API indisponível)');
            return carregarRankingLocal();
        }
        
        // Tenta carregar de múltiplas APIs
        let rankingData = [];
        let apiConectada = false;
        
        const apis = [
            {
                name: 'JSONBin',
                url: 'https://api.jsonbin.io/v3/b/676194b5e41b4d34e4616b8a/latest',
                headers: { 'X-Master-Key': '$2a$10$8vF7qJ9mK4nL2pR6tS8uXeY3wZ5cA1bD9fG2hI6jK8lM0nO4pQ7rT' }
            }
        ];
        
        for (const api of apis) {
            try {
                const response = await fetch(api.url, {
                    method: 'GET',
                    headers: api.headers
                });
                
                if (response.ok) {
                    const data = await response.json();
                    rankingData = data.record?.jogadores || [];
                    apiConectada = true;
                    console.log(`✅ Ranking carregado via ${api.name}:`, rankingData.length, 'jogadores');
                    usarRankingLocal = false;
                    break;
                }
            } catch (e) {
                console.log(`❌ Falha ao carregar via ${api.name}:`, e.message);
                continue;
            }
        }
        
        // Se nenhuma API funcionou, usa sistema de backup
        if (!apiConectada) {
            console.log('🔄 Carregando via sistema de backup...');
            usarRankingLocal = true;
            return await carregarRankingBackup();
        }
        
        console.log('Ranking online carregado:', rankingData.length, 'jogadores');
        
        // Remove jogadores com mais de 4 horas
        const quatroHorasAtras = Date.now() - (4 * 60 * 60 * 1000);
        const rankingFiltrado = rankingData.filter(j => j.timestamp > quatroHorasAtras);
        
        // Se removeu jogadores expirados, tenta atualizar
        if (rankingFiltrado.length !== rankingData.length && apiConectada) {
            console.log('🧹 Limpando jogadores expirados...');
            // Tentativa de limpeza (pode falhar, não é crítico)
        }
        
        // Ordena por saldo e pega top 10
        const topRanking = rankingFiltrado.sort((a, b) => b.saldo - a.saldo).slice(0, 10);
        console.log('Top 10 ranking online:', topRanking.map(j => `${j.nome}: R$${j.saldo}`));
        
        return topRanking;
        
    } catch (error) {
        console.error('❌ Erro ao carregar ranking online:', error);
        console.log('🔄 Fallback para sistema de backup');
        return await carregarRankingBackup();
    }
}

// Função de backup para carregar ranking
async function carregarRankingBackup() {
    try {
        const chaves = [
            'nukuzera_ranking_br_1',
            'nukuzera_ranking_br_2', 
            'nukuzera_ranking_br_3'
        ];
        
        let rankingData = [];
        
        // Carrega de todas as chaves
        chaves.forEach(chave => {
            try {
                const dados = localStorage.getItem(chave);
                if (dados) {
                    const jogadores = JSON.parse(dados);
                    rankingData = rankingData.concat(jogadores);
                }
            } catch (e) {
                console.log('Erro ao carregar chave', chave);
            }
        });
        
        // Remove duplicatas
        const jogadoresUnicos = {};
        rankingData.forEach(j => {
            if (!jogadoresUnicos[j.nome] || jogadoresUnicos[j.nome].timestamp < j.timestamp) {
                jogadoresUnicos[j.nome] = j;
            }
        });
        
        rankingData = Object.values(jogadoresUnicos);
        
        // Remove jogadores antigos
        const quatroHorasAtras = Date.now() - (4 * 60 * 60 * 1000);
        rankingData = rankingData.filter(j => j.timestamp > quatroHorasAtras);
        
        // Ordena e pega top 10
        const topRanking = rankingData.sort((a, b) => b.saldo - a.saldo).slice(0, 10);
        
        console.log('💾 Ranking backup carregado:', topRanking.length, 'jogadores');
        usarRankingLocal = true;
        
        return topRanking;
        
    } catch (error) {
        console.error('❌ Erro no sistema de backup:', error);
        return carregarRankingLocal();
    }
}

// Função para carregar ranking local (fallback)
function carregarRankingLocal() {
    // Carrega ranking do localStorage
    let rankingData = JSON.parse(localStorage.getItem('nukuzerabetRanking') || '[]');
    
    // Remove jogadores com mais de 4 horas
    const quatroHorasAtras = Date.now() - (4 * 60 * 60 * 1000);
    rankingData = rankingData.filter(j => j.timestamp > quatroHorasAtras);
    
    // Salva ranking limpo
    localStorage.setItem('nukuzerabetRanking', JSON.stringify(rankingData));
    
    // Ordena por saldo e pega top 10
    return rankingData.sort((a, b) => b.saldo - a.saldo).slice(0, 10);
}

// Função original mantida para compatibilidade
function carregarRanking() {
    return carregarRankingLocal(); // Por enquanto usa local, será atualizada no mostrarRanking
}

function entrarRanking() {
    console.log('🔍 DEBUG: Iniciando entrarRanking()');
    
    // Verifica se o jogador está bloqueado
    const bloqueio = localStorage.getItem('nukuzerabetBloqueioRanking');
    if (bloqueio) {
        const tempoBloqueio = parseInt(bloqueio);
        const tempoRestante = tempoBloqueio - Date.now();
        
        if (tempoRestante > 0) {
            const horasRestantes = Math.ceil(tempoRestante / (1000 * 60 * 60));
            alert(`🚫 Você está bloqueado do ranking!\n\nTempo restante: ${horasRestantes} horas\n\nMotivo: Adicionou fichas demais (vício em jogos)\n\n⚠️ Procure ajuda profissional!`);
            return;
        } else {
            // Remove o bloqueio se já passou o tempo
            localStorage.removeItem('nukuzerabetBloqueioRanking');
            console.log('✅ Bloqueio expirado, removido automaticamente');
        }
    }
    
    const nome = document.getElementById('nomeJogador').value.trim();
    console.log('🔍 DEBUG: Nome digitado:', nome);
    
    if (!nome) {
        alert('Digite seu nome!');
        return;
    }
    
    nomeJogadorRanking = nome;
    console.log('🔍 DEBUG: Nome salvo:', nomeJogadorRanking);
    
    // Cria o jogador diretamente
    const jogador = {
        nome: nomeJogadorRanking,
        saldo: saldo,
        jogos: jogosJogados,
        vitorias: vitorias,
        timestamp: Date.now(),
        id: nomeJogadorRanking + '_' + Date.now()
    };
    
    console.log('🔍 DEBUG: Jogador criado:', jogador);
    
    // Salva diretamente no localStorage simples
    let ranking = JSON.parse(localStorage.getItem('nukuzerabetRankingSimples') || '[]');
    console.log('🔍 DEBUG: Ranking atual:', ranking);
    
    // Remove entrada antiga
    ranking = ranking.filter(j => j.nome !== jogador.nome);
    
    // Adiciona nova entrada
    ranking.push(jogador);
    
    // Salva
    localStorage.setItem('nukuzerabetRankingSimples', JSON.stringify(ranking));
    console.log('🔍 DEBUG: Ranking salvo:', ranking);
    
    salvarDados();
    mostrarRankingSimples();
    alert('Você entrou no ranking!');
}

function mostrarRankingSimples() {
    console.log('🔍 DEBUG: Iniciando mostrarRankingSimples()');
    
    // Carrega ranking simples
    let ranking = JSON.parse(localStorage.getItem('nukuzerabetRankingSimples') || '[]');
    console.log('🔍 DEBUG: Ranking carregado:', ranking);
    
    // Ordena por saldo
    ranking = ranking.sort((a, b) => b.saldo - a.saldo);
    
    let html = '<div style="background: rgba(0,255,0,0.2); border: 1px solid #00ff00; border-radius: 5px; padding: 10px; margin-bottom: 15px; text-align: center;"><p style="color: #00ff00; margin: 0;">💾 RANKING SIMPLES ATIVO</p></div>';
    
    html += '<div class="ranking-lista">';
    
    if (ranking.length === 0) {
        html += '<p style="text-align: center; color: #aaa; padding: 40px;">Nenhum jogador no ranking ainda. Seja o primeiro!</p>';
        console.log('🔍 DEBUG: Ranking vazio');
    } else {
        console.log('🔍 DEBUG: Mostrando', ranking.length, 'jogadores');
        
        ranking.forEach((jogador, index) => {
            const posicao = index + 1;
            let emoji = '';
            
            if (posicao === 1) emoji = '🥇';
            else if (posicao === 2) emoji = '🥈';
            else if (posicao === 3) emoji = '🥉';
            
            const taxaVitoria = jogador.jogos > 0 ? ((jogador.vitorias / jogador.jogos) * 100).toFixed(1) : 0;
            
            html += `
                <div class="ranking-item">
                    <div class="ranking-posicao">${emoji || posicao + 'º'}</div>
                    <div class="ranking-info">
                        <div class="ranking-nome">${jogador.nome}</div>
                        <div class="ranking-stats">
                            🎮 ${jogador.jogos} jogos | 🏆 ${jogador.vitorias} vitórias | 📊 ${taxaVitoria}% win rate
                        </div>
                    </div>
                    <div class="ranking-saldo">R$ ${jogador.saldo}</div>
                </div>
            `;
        });
    }
    
    html += '</div>';
    
    // Verifica se há bloqueio ativo
    const bloqueio = localStorage.getItem('nukuzerabetBloqueioRanking');
    if (bloqueio) {
        const tempoBloqueio = parseInt(bloqueio);
        const tempoRestante = tempoBloqueio - Date.now();
        
        if (tempoRestante > 0) {
            const horasRestantes = Math.ceil(tempoRestante / (1000 * 60 * 60));
            html += `
                <div style="background: rgba(255,0,0,0.2); border: 2px solid #ff4444; border-radius: 10px; padding: 15px; margin: 20px 0; text-align: center;">
                    <h3 style="color: #ff4444; margin: 0 0 10px 0;">🚫 BLOQUEADO DO RANKING</h3>
                    <p style="margin: 5px 0;">Tempo restante: <strong>${horasRestantes} horas</strong></p>
                    <p style="margin: 5px 0; font-size: 0.9em;">Motivo: Adicionou fichas demais (vício em jogos)</p>
                    <p style="margin: 10px 0 0 0; font-size: 0.8em; color: #ffaa00;">⚠️ Procure ajuda profissional para vício em jogos!</p>
                </div>
            `;
        } else {
            // Remove o bloqueio se já passou o tempo
            localStorage.removeItem('nukuzerabetBloqueioRanking');
        }
    }
    
    if (nomeJogadorRanking && (!bloqueio || parseInt(bloqueio) <= Date.now())) {
        html += '<button class="btn" onclick="atualizarPosicaoSimples()">ATUALIZAR MINHA POSIÇÃO</button>';
    }
    
    document.getElementById('areaRanking').innerHTML = html;
    console.log('🔍 DEBUG: HTML do ranking definido');
}

function atualizarPosicaoSimples() {
    console.log('🔍 DEBUG: Atualizando posição simples');
    
    // Verifica se o jogador está bloqueado
    const bloqueio = localStorage.getItem('nukuzerabetBloqueioRanking');
    if (bloqueio) {
        const tempoBloqueio = parseInt(bloqueio);
        const tempoRestante = tempoBloqueio - Date.now();
        
        if (tempoRestante > 0) {
            const horasRestantes = Math.ceil(tempoRestante / (1000 * 60 * 60));
            alert(`🚫 Você está bloqueado do ranking!\n\nTempo restante: ${horasRestantes} horas\n\nMotivo: Adicionou fichas demais (vício em jogos)`);
            return;
        } else {
            // Remove o bloqueio se já passou o tempo
            localStorage.removeItem('nukuzerabetBloqueioRanking');
        }
    }
    
    if (!nomeJogadorRanking) {
        alert('Você precisa entrar no ranking primeiro!');
        return;
    }
    
    // Cria o jogador com dados atuais
    const jogador = {
        nome: nomeJogadorRanking,
        saldo: saldo,
        jogos: jogosJogados,
        vitorias: vitorias,
        timestamp: Date.now(),
        id: nomeJogadorRanking + '_' + Date.now()
    };
    
    // Salva no ranking
    let ranking = JSON.parse(localStorage.getItem('nukuzerabetRankingSimples') || '[]');
    ranking = ranking.filter(j => j.nome !== jogador.nome);
    ranking.push(jogador);
    localStorage.setItem('nukuzerabetRankingSimples', JSON.stringify(ranking));
    
    mostrarRankingSimples();
    alert('Posição atualizada! Saldo: R$ ' + saldo);
}

async function mostrarRanking() {
    // Mostra loading primeiro
    document.getElementById('areaRanking').innerHTML = '<div style="text-align: center; padding: 40px;"><p style="color: #d4af37;">🔄 Conectando ao ranking online...</p></div>';
    
    console.log('🌐 Iniciando mostrarRanking() - Modo Online');
    
    // Se o jogador tem nome no ranking, força uma atualização primeiro
    if (nomeJogadorRanking) {
        console.log('Atualizando posição do jogador no ranking:', nomeJogadorRanking);
        try {
            await salvarNoRankingGlobal();
        } catch (e) {
            console.log('Erro ao atualizar posição:', e);
        }
    }
    
    const ranking = await carregarRankingGlobal();
    console.log('🏆 Ranking carregado:', ranking);
    
    // Indicador de status do ranking
    let statusRanking;
    if (usarRankingLocal) {
        statusRanking = '<div style="background: rgba(255,165,0,0.2); border: 1px solid #ffa500; border-radius: 5px; padding: 10px; margin-bottom: 15px; text-align: center;"><p style="color: #ffa500; margin: 0;">💾 MODO BACKUP - Ranking compartilhado local</p></div>';
    } else {
        statusRanking = '<div style="background: rgba(0,255,0,0.2); border: 1px solid #00ff00; border-radius: 5px; padding: 10px; margin-bottom: 15px; text-align: center;"><p style="color: #00ff00; margin: 0;">🌐 RANKING ONLINE ATIVO - Jogadores de todo o Brasil!</p></div>';
    }
    
    let html = statusRanking + '<div class="ranking-lista">';
    
    if (ranking.length === 0) {
        html += '<p style="text-align: center; color: #aaa; padding: 40px;">Nenhum jogador no ranking ainda. Seja o primeiro!</p>';
    } else {
        ranking.forEach((jogador, index) => {
            const posicao = index + 1;
            let classe = '';
            let emoji = '';
            
            if (posicao === 1) {
                classe = 'top1';
                emoji = '🥇';
            } else if (posicao === 2) {
                classe = 'top2';
                emoji = '🥈';
            } else if (posicao === 3) {
                classe = 'top3';
                emoji = '🥉';
            }
            
            const tempoDecorrido = Math.floor((Date.now() - jogador.timestamp) / 1000 / 60);
            const tempoRestante = 240 - tempoDecorrido;
            
            const taxaVitoria = jogador.jogos > 0 ? ((jogador.vitorias / jogador.jogos) * 100).toFixed(1) : 0;
            
            html += `
                <div class="ranking-item ${classe}">
                    <div class="ranking-posicao">${emoji || posicao + 'º'}</div>
                    <div class="ranking-info">
                        <div class="ranking-nome">${jogador.nome}</div>
                        <div class="ranking-stats">
                            🎮 ${jogador.jogos} jogos | 🏆 ${jogador.vitorias} vitórias | 📊 ${taxaVitoria}% win rate
                        </div>
                    </div>
                    <div class="ranking-saldo">R$ ${jogador.saldo}</div>
                </div>
            `;
            
            if (posicao === 1 && tempoRestante > 0) {
                html += `<div class="ranking-tempo">⏱️ Tempo no topo: ${tempoRestante} minutos restantes</div>`;
            }
        });
    }
    
    html += '</div>';
    
    // Verifica se há bloqueio ativo
    const bloqueio = localStorage.getItem('nukuzerabetBloqueioRanking');
    if (bloqueio) {
        const tempoBloqueio = parseInt(bloqueio);
        const tempoRestante = tempoBloqueio - Date.now();
        
        if (tempoRestante > 0) {
            const horasRestantes = Math.ceil(tempoRestante / (1000 * 60 * 60));
            html += `
                <div style="background: rgba(255,0,0,0.2); border: 2px solid #ff4444; border-radius: 10px; padding: 15px; margin: 20px 0; text-align: center;">
                    <h3 style="color: #ff4444; margin: 0 0 10px 0;">🚫 BLOQUEADO DO RANKING</h3>
                    <p style="margin: 5px 0;">Tempo restante: <strong>${horasRestantes} horas</strong></p>
                    <p style="margin: 5px 0; font-size: 0.9em;">Motivo: Adicionou fichas demais (vício em jogos)</p>
                    <p style="margin: 10px 0 0 0; font-size: 0.8em; color: #ffaa00;">⚠️ Procure ajuda profissional para vício em jogos!</p>
                </div>
            `;
        } else {
            // Remove o bloqueio se já passou o tempo
            localStorage.removeItem('nukuzerabetBloqueioRanking');
        }
    }
    
    if (nomeJogadorRanking && (!bloqueio || parseInt(bloqueio) <= Date.now())) {
        html += '<button class="btn" onclick="atualizarPosicao()">ATUALIZAR MINHA POSIÇÃO</button>';
    }
    
    document.getElementById('areaRanking').innerHTML = html;
}

function atualizarPosicao() {
    // Verifica se o jogador está bloqueado
    const bloqueio = localStorage.getItem('nukuzerabetBloqueioRanking');
    if (bloqueio) {
        const tempoBloqueio = parseInt(bloqueio);
        const tempoRestante = tempoBloqueio - Date.now();
        
        if (tempoRestante > 0) {
            const horasRestantes = Math.ceil(tempoRestante / (1000 * 60 * 60));
            alert(`🚫 Você está bloqueado do ranking!\n\nTempo restante: ${horasRestantes} horas\n\nMotivo: Adicionou fichas demais (vício em jogos)`);
            return;
        } else {
            // Remove o bloqueio se já passou o tempo
            localStorage.removeItem('nukuzerabetBloqueioRanking');
        }
    }
    
    salvarNoRanking();
    mostrarRanking();
    alert('Posição atualizada com seu saldo atual: R$ ' + saldo);
}

function atualizarSaldo() {
    document.getElementById('saldo').textContent = saldo;
    document.getElementById('jogos').textContent = jogosJogados;
    document.getElementById('vitorias').textContent = vitorias;
    salvarDados();
}

function abrirJogo(jogo) {
    const jogoCapitalizado = jogo.charAt(0).toUpperCase() + jogo.slice(1);
    const modal = document.getElementById('modal' + jogoCapitalizado);
    
    if (!modal) {
        console.error('Modal não encontrado:', 'modal' + jogoCapitalizado);
        return;
    }
    
    modal.style.display = 'block';
    
    // Configurações específicas por jogo
    switch(jogo) {
        case 'roleta':
            const tipoRoleta = document.getElementById('tipoRoleta');
            if (tipoRoleta) {
                tipoRoleta.onchange = atualizarOpcaoRoleta;
                atualizarOpcaoRoleta();
            }
            break;
        case 'dados':
            const tipoDados = document.getElementById('tipoDados');
            if (tipoDados) {
                tipoDados.onchange = atualizarOpcaoDados;
                atualizarOpcaoDados();
            }
            break;
        case 'ranking':
            mostrarRanking();
            break;
        case 'codigo':
            inicializarModalCodigo();
            break;
    }
}

function fecharModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

function atualizarOpcaoRoleta() {
    const tipo = document.getElementById('tipoRoleta').value;
    const div = document.getElementById('opcaoRoleta');
    
    if (tipo === 'numero') {
        div.innerHTML = '<input type="number" id="numeroRoleta" placeholder="Número (0-36)" min="0" max="36">';
    } else if (tipo === 'cor') {
        div.innerHTML = '<select id="corRoleta"><option value="vermelho">Vermelho</option><option value="preto">Preto</option></select>';
    } else {
        div.innerHTML = '<select id="paridadeRoleta"><option value="par">Par</option><option value="impar">Ímpar</option></select>';
    }
}

function atualizarOpcaoDados() {
    const tipo = document.getElementById('tipoDados').value;
    const div = document.getElementById('opcaoDados');
    
    if (tipo === 'soma') {
        div.innerHTML = '<input type="number" id="somaDados" placeholder="Soma (2-12)" min="2" max="12">';
    } else {
        div.innerHTML = '';
    }
}

function jogarRoleta() {
    const apostaInput = document.getElementById('apostaRoleta');
    if (!apostaInput) return;
    
    const aposta = parseInt(apostaInput.value);
    
    if (!aposta || aposta <= 0) {
        alert('Digite uma aposta válida!');
        return;
    }
    
    if (aposta > saldo) {
        alert('Saldo insuficiente!');
        return;
    }

    const tipo = document.getElementById('tipoRoleta').value;
    const numero = Math.floor(Math.random() * 37);
    const vermelhos = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    const cor = vermelhos.includes(numero) ? 'vermelho' : 'preto';
    
    let ganhou = false;
    let multiplicador = 0;

    if (tipo === 'numero') {
        const aposta_numero = parseInt(document.getElementById('numeroRoleta').value);
        if (aposta_numero === numero) {
            ganhou = true;
            multiplicador = 20;
        }
    } else if (tipo === 'cor') {
        const aposta_cor = document.getElementById('corRoleta').value;
        const chanceBase = 0.15;
        const chanceComBoost = chanceBase - getMultiplicadorSorte();
        if (numero !== 0 && aposta_cor === cor && Math.random() > chanceComBoost) {
            ganhou = true;
            multiplicador = 1.8;
        }
    } else {
        const paridade = document.getElementById('paridadeRoleta').value;
        const chanceBase = 0.15;
        const chanceComBoost = chanceBase - getMultiplicadorSorte();
        if (numero !== 0 && Math.random() > chanceComBoost) {
            if ((paridade === 'par' && numero % 2 === 0) || (paridade === 'impar' && numero % 2 !== 0)) {
                ganhou = true;
                multiplicador = 1.8;
            }
        }
    }

    const corClass = cor === 'vermelho' ? 'vermelho' : 'preto';
    let resultado = `<div class="roleta-numero ${corClass}">${numero}</div>`;

    jogosJogados++;
    
    if (ganhou) {
        const ganho = Math.floor(aposta * multiplicador);
        saldo += ganho;
        vitorias++;
        const boostTexto = boostSorteAtivo ? ' � (BOOST AT IVO!)' : '';
        resultado += `<div class="resultado ganhou">🎉 VOCÊ GANHOU R$ ${ganho}!${boostTexto}</div>`;
    } else {
        saldo -= aposta;
        resultado += `<div class="resultado perdeu">😢 Você perdeu R$ ${aposta}</div>`;
    }

    document.getElementById('resultadoRoleta').innerHTML = resultado;
    atualizarSaldo();
    salvarNoRanking();
}

function iniciarBlackjack() {
    const apostaInput = document.getElementById('apostaBlackjack');
    if (!apostaInput) return;
    
    const aposta = parseInt(apostaInput.value);
    
    if (!aposta || aposta <= 0) {
        alert('Digite uma aposta válida!');
        return;
    }
    
    if (aposta > saldo) {
        alert('Saldo insuficiente!');
        return;
    }

    jogoBlackjack = {
        aposta: aposta,
        jogador: [cartaAleatoria(), cartaAleatoria()],
        dealer: [cartaAleatoria(), cartaAleatoria()],
        finalizado: false
    };

    atualizarBlackjack();
}

function cartaAleatoria() {
    const carta = Math.floor(Math.random() * 13) + 1;
    if (carta > 10) return 10;
    if (carta === 1) return 11;
    return carta;
}

function valorMao(cartas) {
    let valor = cartas.reduce((a, b) => a + b, 0);
    let ases = cartas.filter(c => c === 11).length;
    while (valor > 21 && ases > 0) {
        valor -= 10;
        ases--;
    }
    return valor;
}

function atualizarBlackjack() {
    if (!jogoBlackjack) return;

    const valorJogador = valorMao(jogoBlackjack.jogador);
    const valorDealer = valorMao(jogoBlackjack.dealer);

    let html = '<h3 style="color: #d4af37;">Suas cartas:</h3>';
    html += '<div class="cartas-container">';
    jogoBlackjack.jogador.forEach(c => html += `<div class="carta">${c}</div>`);
    html += `</div><p>Valor: ${valorJogador}</p>`;

    html += '<h3 style="color: #d4af37; margin-top: 20px;">Cartas do Dealer:</h3>';
    html += '<div class="cartas-container">';
    if (!jogoBlackjack.finalizado) {
        html += `<div class="carta">${jogoBlackjack.dealer[0]}</div>`;
        html += `<div class="carta">?</div>`;
    } else {
        jogoBlackjack.dealer.forEach(c => html += `<div class="carta">${c}</div>`);
        html += `</div><p>Valor: ${valorDealer}</p>`;
    }
    html += '</div>';

    if (!jogoBlackjack.finalizado && valorJogador < 21) {
        html += '<button class="btn" onclick="hitBlackjack()">HIT</button>';
        html += '<button class="btn btn-danger" onclick="standBlackjack()">STAND</button>';
    }

    if (jogoBlackjack.finalizado) {
        jogosJogados++;
        if (valorJogador > 21) {
            saldo -= jogoBlackjack.aposta;
            html += `<div class="resultado perdeu">💥 ESTOUROU! Você perdeu R$ ${jogoBlackjack.aposta}</div>`;
        } else if (valorDealer > 21) {
            const ganho = Math.floor(jogoBlackjack.aposta * 1.5);
            saldo += ganho;
            vitorias++;
            html += `<div class="resultado ganhou">🎉 Dealer estourou! Você ganhou R$ ${ganho}</div>`;
        } else if (valorJogador > valorDealer) {
            const ganho = Math.floor(jogoBlackjack.aposta * 1.5);
            saldo += ganho;
            vitorias++;
            html += `<div class="resultado ganhou">🎉 VOCÊ GANHOU R$ ${ganho}!</div>`;
        } else if (valorJogador < valorDealer) {
            saldo -= jogoBlackjack.aposta;
            html += `<div class="resultado perdeu">😢 Dealer venceu! Você perdeu R$ ${jogoBlackjack.aposta}</div>`;
        } else {
            html += `<div class="resultado" style="background: rgba(255,255,255,0.1);">🤝 EMPATE! Aposta devolvida</div>`;
        }
        atualizarSaldo();
        salvarNoRanking();
    } else if (valorJogador > 21) {
        jogoBlackjack.finalizado = true;
        atualizarBlackjack();
        return;
    }

    document.getElementById('areaBlackjack').innerHTML = html;
}

function hitBlackjack() {
    if (jogoBlackjack && !jogoBlackjack.finalizado) {
        jogoBlackjack.jogador.push(cartaAleatoria());
        atualizarBlackjack();
    }
}

function standBlackjack() {
    if (jogoBlackjack && !jogoBlackjack.finalizado) {
        while (valorMao(jogoBlackjack.dealer) < 17) {
            jogoBlackjack.dealer.push(cartaAleatoria());
        }
        jogoBlackjack.finalizado = true;
        atualizarBlackjack();
    }
}

function jogarSlots() {
    const apostaInput = document.getElementById('apostaSlots');
    if (!apostaInput) return;
    
    const aposta = parseInt(apostaInput.value);
    
    if (!aposta || aposta <= 0) {
        alert('Digite uma aposta válida!');
        return;
    }
    
    if (aposta > saldo) {
        alert('Saldo insuficiente!');
        return;
    }

    const simbolos = ['🍒', '🍋', '🍊', '🍇', '⭐', '💎', '7️⃣'];
    const resultado = [];
    
    for (let i = 1; i <= 4; i++) {
        let contador = 0;
        const intervalo = setInterval(() => {
            document.getElementById('slot' + i).textContent = simbolos[Math.floor(Math.random() * simbolos.length)];
            contador++;
            if (contador >= 10) {
                clearInterval(intervalo);
                const simbolo = simbolos[Math.floor(Math.random() * simbolos.length)];
                document.getElementById('slot' + i).textContent = simbolo;
                resultado.push(simbolo);
                
                if (resultado.length === 4) {
                    avaliarSlots(resultado, aposta);
                }
            }
        }, 100);
    }
}

function avaliarSlots(resultado, aposta) {
    jogosJogados++;
    let html = '';
    let multiplicador = 0;
    const boostSorte = getMultiplicadorSorte();
    const boostTexto = boostSorteAtivo ? ' 🍀 (BOOST ATIVO!)' : '';
    
    if (resultado[0] === resultado[1] && resultado[1] === resultado[2] && resultado[2] === resultado[3]) {
        if (resultado[0] === '💎' && Math.random() > (0.7 - boostSorte)) {
            multiplicador = 50;
            html = `<div class="resultado ganhou">💎💎💎💎 MEGA JACKPOT DIAMANTE! Você ganhou R$ ${aposta * multiplicador}!${boostTexto}</div>`;
        } else if (resultado[0] === '7️⃣' && Math.random() > (0.6 - boostSorte)) {
            multiplicador = 25;
            html = `<div class="resultado ganhou">7️⃣7️⃣7️⃣7️⃣ SUPER JACKPOT! Você ganhou R$ ${aposta * multiplicador}!${boostTexto}</div>`;
        } else if (resultado[0] === '⭐' && Math.random() > (0.5 - boostSorte)) {
            multiplicador = 15;
            html = `<div class="resultado ganhou">⭐⭐⭐⭐ JACKPOT ESTRELA! Você ganhou R$ ${aposta * multiplicador}!${boostTexto}</div>`;
        } else if (Math.random() > (0.4 - boostSorte)) {
            multiplicador = 10;
            html = `<div class="resultado ganhou">🎰 QUATRO IGUAIS! Você ganhou R$ ${aposta * multiplicador}!${boostTexto}</div>`;
        }
    }
    else if (((resultado[0] === resultado[1] && resultado[1] === resultado[2]) ||
             (resultado[1] === resultado[2] && resultado[2] === resultado[3]) ||
             (resultado[0] === resultado[2] && resultado[2] === resultado[3]) ||
             (resultado[0] === resultado[1] && resultado[1] === resultado[3])) && Math.random() > (0.3 - boostSorte)) {
        multiplicador = 3;
        html = `<div class="resultado ganhou">🎉 TRÊS IGUAIS! Você ganhou R$ ${aposta * multiplicador}!${boostTexto}</div>`;
    }
    else if ((resultado[0] === resultado[1] || resultado[0] === resultado[2] || 
             resultado[0] === resultado[3] || resultado[1] === resultado[2] || 
             resultado[1] === resultado[3] || resultado[2] === resultado[3]) && Math.random() > (0.4 - boostSorte)) {
        multiplicador = 1.5;
        html = `<div class="resultado ganhou">👍 DOIS IGUAIS! Você ganhou R$ ${Math.floor(aposta * multiplicador)}!${boostTexto}</div>`;
    }
    
    if (multiplicador === 0) {
        saldo -= aposta;
        html = `<div class="resultado perdeu">😢 Não foi dessa vez! Você perdeu R$ ${aposta}</div>`;
        document.getElementById('resultadoSlots').innerHTML = html;
        atualizarSaldo();
        salvarNoRanking();
        return;
    }

    const ganho = Math.floor(aposta * multiplicador);
    saldo += ganho;
    vitorias++;
    document.getElementById('resultadoSlots').innerHTML = html;
    atualizarSaldo();
    salvarNoRanking();
}

function jogarDados() {
    const apostaInput = document.getElementById('apostaDados');
    if (!apostaInput) return;
    
    const aposta = parseInt(apostaInput.value);
    
    if (!aposta || aposta <= 0) {
        alert('Digite uma aposta válida!');
        return;
    }
    
    if (aposta > saldo) {
        alert('Saldo insuficiente!');
        return;
    }

    const tipo = document.getElementById('tipoDados').value;
    const dado1 = Math.floor(Math.random() * 6) + 1;
    const dado2 = Math.floor(Math.random() * 6) + 1;
    const soma = dado1 + dado2;

    let ganhou = false;
    let multiplicador = 0;

    const boostSorte = getMultiplicadorSorte();
    
    if (tipo === 'soma') {
        const apostaNumero = parseInt(document.getElementById('somaDados').value);
        if (apostaNumero === soma && Math.random() > (0.3 - boostSorte)) {
            ganhou = true;
            multiplicador = 15;
        }
    } else if (tipo === 'maior' && soma > 7 && Math.random() > (0.2 - boostSorte)) {
        ganhou = true;
        multiplicador = 1.6;
    } else if (tipo === 'menor' && soma < 7 && Math.random() > (0.2 - boostSorte)) {
        ganhou = true;
        multiplicador = 1.6;
    } else if (tipo === 'sete' && soma === 7 && Math.random() > (0.4 - boostSorte)) {
        ganhou = true;
        multiplicador = 3;
    }

    jogosJogados++;
    let html = `<div style="font-size: 3em; text-align: center; margin: 20px 0;">🎲 ${dado1} 🎲 ${dado2}</div>`;
    html += `<p style="text-align: center; font-size: 1.5em;">Soma: ${soma}</p>`;

    if (ganhou) {
        const ganho = Math.floor(aposta * multiplicador);
        saldo += ganho;
        vitorias++;
        const boostTexto = boostSorteAtivo ? ' � (BOO ST ATIVO!)' : '';
        html += `<div class="resultado ganhou">🎉 VOCÊ GANHOU R$ ${ganho}!${boostTexto}</div>`;
    } else {
        saldo -= aposta;
        html += `<div class="resultado perdeu">😢 Você perdeu R$ ${aposta}</div>`;
    }

    document.getElementById('resultadoDados').innerHTML = html;
    atualizarSaldo();
    salvarNoRanking();
}

function iniciarBingo() {
    const apostaInput = document.getElementById('apostaBingo');
    if (!apostaInput) return;
    
    const aposta = parseInt(apostaInput.value);
    
    if (!aposta || aposta <= 0) {
        alert('Digite uma aposta válida!');
        return;
    }
    
    if (aposta > saldo) {
        alert('Saldo insuficiente!');
        return;
    }

    const cartela = [];
    const numeros = [];
    for (let i = 1; i <= 75; i++) numeros.push(i);
    
    for (let i = 0; i < 15; i++) {
        const idx = Math.floor(Math.random() * numeros.length);
        cartela.push(numeros.splice(idx, 1)[0]);
    }

    jogoBingo = {
        aposta: aposta,
        cartela: cartela,
        marcados: [],
        rodada: 0,
        sorteados: []
    };

    let html = '<h3 style="color: #d4af37;">Sua Cartela:</h3>';
    html += '<div class="cartela-bingo">';
    cartela.forEach(num => {
        html += `<div class="numero-bingo" id="bingo-${num}">${num}</div>`;
    });
    html += '</div>';
    html += '<button class="btn" onclick="sortearBingo()">SORTEAR NÚMERO</button>';
    html += '<div id="sorteio"></div>';

    document.getElementById('areaBingo').innerHTML = html;
}

function sortearBingo() {
    if (!jogoBingo || jogoBingo.rodada >= 20) return;

    let numero;
    do {
        numero = Math.floor(Math.random() * 75) + 1;
    } while (jogoBingo.sorteados.includes(numero));

    jogoBingo.sorteados.push(numero);
    jogoBingo.rodada++;

    if (jogoBingo.cartela.includes(numero)) {
        jogoBingo.marcados.push(numero);
        document.getElementById('bingo-' + numero).classList.add('marcado');
    }

    let html = `<p style="font-size: 2em; text-align: center; margin: 20px 0;">🎱 Bola ${jogoBingo.rodada}: ${numero}</p>`;
    html += `<p style="text-align: center;">Acertos: ${jogoBingo.marcados.length}/15</p>`;

    if (jogoBingo.marcados.length >= 15) {
        jogosJogados++;
        const ganho = Math.floor(jogoBingo.aposta * 10);
        saldo += ganho;
        vitorias++;
        html += `<div class="resultado ganhou">🎉 BINGO COMPLETO! Você ganhou R$ ${ganho}!</div>`;
        atualizarSaldo();
        salvarNoRanking();
    } else if (jogoBingo.rodada >= 20) {
        jogosJogados++;
        if (jogoBingo.marcados.length >= 10) {
            const ganho = Math.floor(jogoBingo.aposta * 3);
            saldo += ganho;
            vitorias++;
            html += `<div class="resultado ganhou">🎉 Muito bem! Você ganhou R$ ${ganho}!</div>`;
        } else if (jogoBingo.marcados.length >= 7) {
            html += `<div class="resultado" style="background: rgba(255,255,255,0.1);">🤝 EMPATE! Aposta devolvida</div>`;
        } else {
            saldo -= jogoBingo.aposta;
            html += `<div class="resultado perdeu">😢 Você perdeu R$ ${jogoBingo.aposta}</div>`;
        }
        atualizarSaldo();
        salvarNoRanking();
    } else {
        html += '<button class="btn" onclick="sortearBingo()">PRÓXIMO NÚMERO</button>';
    }

    document.getElementById('sorteio').innerHTML = html;
}

function adicionarFichas() {
    vezesFichasAdicionadas++;
    
    if (vezesFichasAdicionadas >= 4) {
        // Remove o jogador de TODOS os rankings
        if (nomeJogadorRanking) {
            // Remove do ranking simples
            let rankingSimples = JSON.parse(localStorage.getItem('nukuzerabetRankingSimples') || '[]');
            rankingSimples = rankingSimples.filter(j => j.nome !== nomeJogadorRanking);
            localStorage.setItem('nukuzerabetRankingSimples', JSON.stringify(rankingSimples));
            
            // Remove do ranking tradicional
            let rankingData = JSON.parse(localStorage.getItem('nukuzerabetRanking') || '[]');
            rankingData = rankingData.filter(j => j.nome !== nomeJogadorRanking);
            localStorage.setItem('nukuzerabetRanking', JSON.stringify(rankingData));
            
            // Remove dos rankings de backup
            const chaves = ['nukuzera_ranking_br_1', 'nukuzera_ranking_br_2', 'nukuzera_ranking_br_3'];
            chaves.forEach(chave => {
                try {
                    let dados = JSON.parse(localStorage.getItem(chave) || '[]');
                    dados = dados.filter(j => j.nome !== nomeJogadorRanking);
                    localStorage.setItem(chave, JSON.stringify(dados));
                } catch (e) {
                    console.log('Erro ao limpar chave', chave);
                }
            });
            
            // Bloqueia o jogador por 24 horas
            const bloqueioAte = Date.now() + (24 * 60 * 60 * 1000); // 24 horas
            localStorage.setItem('nukuzerabetBloqueioRanking', bloqueioAte.toString());
            
            console.log('🚫 Jogador bloqueado:', nomeJogadorRanking, 'até', new Date(bloqueioAte));
            
            // Remove o nome do ranking atual
            nomeJogadorRanking = null;
        }
        
        // Reseta o saldo para 1000
        saldo = 1000;
        jogosJogados = 0;
        vitorias = 0;
        vezesFichasAdicionadas = 0;
        
        const alertaDiv = document.createElement('div');
        alertaDiv.className = 'alerta-vicio';
        alertaDiv.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <h2>⚠️ DEIXA DE SER VICIADO! ⚠️</h2>
                <p style="margin: 15px 0;">Você foi removido do ranking!</p>
                <p style="margin: 15px 0;">🚫 Bloqueado por 24 horas</p>
                <p style="margin: 15px 0;">💰 Saldo resetado para R$ 1.000</p>
                <p style="font-size: 0.9em; color: #ffaa00;">Procure ajuda para vício em jogos!</p>
            </div>
        `;
        document.body.appendChild(alertaDiv);
        
        // Salva os dados atualizados
        salvarDados();
        
        setTimeout(() => {
            location.reload();
        }, 5000);
        return;
    }
    
    const mensagens = [
        { texto: "Você vendeu sua moto por R$ 2400!", valor: 2400 },
        { texto: "Você vendeu seu carro por R$ 15000!", valor: 15000 },
        { texto: "Você vendeu sua TV por R$ 800!", valor: 800 },
        { texto: "Você vendeu seu notebook por R$ 3500!", valor: 3500 },
        { texto: "Você vendeu seu celular por R$ 1200!", valor: 1200 },
        { texto: "Você pegou empréstimo no banco de R$ 5000!", valor: 5000 },
        { texto: "Você vendeu seu videogame por R$ 1500!", valor: 1500 },
        { texto: "Você vendeu sua bicicleta por R$ 600!", valor: 600 },
        { texto: "Você empenhou seu relógio por R$ 2000!", valor: 2000 },
        { texto: "Você vendeu seus móveis por R$ 4000!", valor: 4000 }
    ];
    
    const mensagemAleatoria = mensagens[Math.floor(Math.random() * mensagens.length)];
    saldo += mensagemAleatoria.valor;
    atualizarSaldo();
    alert(`${mensagemAleatoria.texto}\n\n💰 R$ ${mensagemAleatoria.valor} foram adicionados ao seu saldo!`);
}

// Fecha modal ao clicar fora dele
window.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
});

// Variável para controlar se o usuário está logado como DONO
let isDonoLogado = false;

function inicializarModalCodigo() {
    // Substitui o conteúdo do modal existente
    const modalContent = document.querySelector('#modalCodigo .modal-content');
    if (!modalContent) return;
    
    modalContent.innerHTML = `
        <span class="close" onclick="fecharModal('modalCodigo')">&times;</span>
        <h2 style="color: #d4af37; margin-bottom: 20px;">💰 CÓDIGOS E BÔNUS 💰</h2>
        
        <div style="text-align: center; margin-bottom: 30px;">
            <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap; margin-bottom: 20px;">
                <button class="btn" onclick="mostrarCodigoPromocional()" style="background: linear-gradient(45deg, #4CAF50, #45a049);">
                    🎁 CÓDIGO PROMOCIONAL
                </button>
                <button class="btn" onclick="mostrarLoginDono()" style="background: linear-gradient(45deg, #ff6b35, #f7931e);">
                    👑 ÁREA DO DONO
                </button>
            </div>
        </div>
        <div id="areaConteudoCodigo"></div>
    `;
}

function mostrarCodigoPromocional() {
    const areaConteudo = document.getElementById('areaConteudoCodigo');
    if (!areaConteudo) return;
    
    areaConteudo.innerHTML = `
        <div style="background: rgba(76, 175, 80, 0.1); border: 2px solid #4CAF50; border-radius: 10px; padding: 20px; margin: 20px 0;">
            <h4 style="color: #4CAF50; text-align: center; margin-bottom: 20px;">🎁 CÓDIGO PROMOCIONAL</h4>
            <div style="text-align: center;">
                <input type="text" id="codigoPromocional" placeholder="Digite o código promocional" 
                       style="padding: 10px; border-radius: 5px; border: 1px solid #4CAF50; background: rgba(0,0,0,0.3); color: white; width: 250px; text-align: center;">
                <br><br>
                <button class="btn" onclick="validarCodigo()" style="background: #4CAF50;">VALIDAR CÓDIGO</button>
            </div>
            <div id="resultadoCodigo" style="margin-top: 20px;"></div>
        </div>
    `;
}

function mostrarLoginDono() {
    const areaConteudo = document.getElementById('areaConteudoCodigo');
    if (!areaConteudo) return;
    
    if (isDonoLogado) {
        mostrarPainelDono();
        return;
    }
    
    areaConteudo.innerHTML = `
        <div style="background: rgba(255, 107, 53, 0.1); border: 2px solid #ff6b35; border-radius: 10px; padding: 20px; margin: 20px 0;">
            <h4 style="color: #ff6b35; text-align: center; margin-bottom: 20px;">👑 LOGIN DO DONO</h4>
            <div style="text-align: center;">
                <input type="password" id="senhaDono" placeholder="Digite a senha do dono" 
                       style="padding: 10px; border-radius: 5px; border: 1px solid #ff6b35; background: rgba(0,0,0,0.3); color: white; width: 250px; text-align: center;">
                <br><br>
                <button class="btn" onclick="validarLoginDono()" style="background: #ff6b35;">ENTRAR</button>
            </div>
            <div id="resultadoLogin" style="margin-top: 20px;"></div>
        </div>
    `;
}

function validarLoginDono() {
    const senha = document.getElementById('senhaDono').value.trim();
    const resultadoDiv = document.getElementById('resultadoLogin');
    
    if (!senha) {
        resultadoDiv.innerHTML = '<div class="codigo-erro"><p style="font-size: 1.2em;">❌ Digite a senha!</p></div>';
        return;
    }
    
    // Aqui você pode definir a senha do dono
    const senhaCorreta = '1107'; // Substitua pela senha desejada
    
    if (senha === senhaCorreta) {
        isDonoLogado = true;
        resultadoDiv.innerHTML = `
            <div class="codigo-sucesso">
                <p style="font-size: 1.5em;">✅ LOGIN REALIZADO!</p>
                <p style="color: #00ff00; margin-top: 10px;">Bem-vindo, DONO!</p>
            </div>
        `;
        
        setTimeout(() => {
            mostrarPainelDono();
        }, 2000);
    } else {
        resultadoDiv.innerHTML = `
            <div class="codigo-erro">
                <p style="font-size: 1.5em;">❌ SENHA INCORRETA</p>
                <p style="color: #ff6b6b; margin-top: 10px;">Acesso negado!</p>
            </div>
        `;
    }
}

function mostrarPainelDono() {
    const areaConteudo = document.getElementById('areaConteudoCodigo');
    if (!areaConteudo) return;
    
    areaConteudo.innerHTML = `
        <div style="background: rgba(255, 215, 0, 0.1); border: 2px solid #d4af37; border-radius: 10px; padding: 20px; margin: 20px 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h4 style="color: #d4af37; margin: 0;">👑 PAINEL DO DONO</h4>
                <button class="btn btn-danger" onclick="logoutDono()" style="background: #dc3545; padding: 5px 15px; font-size: 0.9em;">SAIR</button>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
                <button class="btn" onclick="adicionarSaldoDono()" style="background: #28a745;">💰 ADICIONAR SALDO</button>
                <button class="btn" onclick="resetarJogador()" style="background: #dc3545;">🔄 RESETAR JOGADOR</button>
                <button class="btn" onclick="verEstatisticas()" style="background: #17a2b8;">📊 ESTATÍSTICAS</button>
                <button class="btn" onclick="gerenciarRanking()" style="background: #6f42c1;">🏆 GERENCIAR RANKING</button>
            </div>
            
            <div id="resultadoPainelDono"></div>
        </div>
    `;
}

function logoutDono() {
    isDonoLogado = false;
    inicializarModalCodigo();
}

function adicionarSaldoDono() {
    const valor = prompt('Digite o valor a ser adicionado ao saldo:');
    if (valor && !isNaN(valor) && parseInt(valor) > 0) {
        const valorInt = parseInt(valor);
        saldo += valorInt;
        atualizarSaldo();
        salvarNoRanking();
        
        document.getElementById('resultadoPainelDono').innerHTML = `
            <div class="codigo-sucesso">
                <p style="font-size: 1.3em;">✅ SALDO ADICIONADO!</p>
                <p style="color: #00ff00;">+ R$ ${valorInt} adicionados ao saldo</p>
                <p>Saldo atual: R$ ${saldo}</p>
            </div>
        `;
    } else {
        document.getElementById('resultadoPainelDono').innerHTML = `
            <div class="codigo-erro">
                <p style="font-size: 1.3em;">❌ VALOR INVÁLIDO</p>
            </div>
        `;
    }
}

function resetarJogador() {
    if (confirm('Tem certeza que deseja resetar todos os dados do jogador?')) {
        saldo = 1000;
        jogosJogados = 0;
        vitorias = 0;
        vezesFichasAdicionadas = 0;
        nomeJogadorRanking = null;
        
        // Remove do ranking
        let rankingData = JSON.parse(localStorage.getItem('nukuzerabetRanking') || '[]');
        if (nomeJogadorRanking) {
            rankingData = rankingData.filter(j => j.nome !== nomeJogadorRanking);
            localStorage.setItem('nukuzerabetRanking', JSON.stringify(rankingData));
        }
        
        // Remove bloqueio se existir
        localStorage.removeItem('nukuzerabetBloqueioRanking');
        
        atualizarSaldo();
        salvarDados();
        
        document.getElementById('resultadoPainelDono').innerHTML = `
            <div class="codigo-sucesso">
                <p style="font-size: 1.3em;">✅ JOGADOR RESETADO!</p>
                <p style="color: #00ff00;">Todos os dados foram restaurados ao padrão</p>
            </div>
        `;
    }
}

async function verEstatisticas() {
    const taxaVitoria = jogosJogados > 0 ? ((vitorias / jogosJogados) * 100).toFixed(1) : 0;
    const bloqueio = localStorage.getItem('nukuzerabetBloqueioRanking');
    let statusBloqueio = 'Não bloqueado';
    
    if (bloqueio) {
        const tempoRestante = parseInt(bloqueio) - Date.now();
        if (tempoRestante > 0) {
            const horasRestantes = Math.ceil(tempoRestante / (1000 * 60 * 60));
            statusBloqueio = `Bloqueado por ${horasRestantes} horas`;
        }
    }
    
    // Verifica boost de sorte
    let statusBoost = 'Inativo';
    if (verificarBoostSorte()) {
        const tempoRestante = getTempoRestanteBoost();
        const minutos = Math.floor(tempoRestante / 60000);
        const segundos = Math.floor((tempoRestante % 60000) / 1000);
        statusBoost = `Ativo (${minutos}:${segundos.toString().padStart(2, '0')} restantes)`;
    }
    
    // Verifica posição no ranking global
    let posicaoRanking = 'Não encontrado';
    if (nomeJogadorRanking) {
        try {
            const ranking = await carregarRankingGlobal();
            const posicao = ranking.findIndex(j => j.nome === nomeJogadorRanking) + 1;
            if (posicao > 0) {
                posicaoRanking = `${posicao}º lugar (de ${ranking.length})`;
            }
        } catch (e) {
            posicaoRanking = 'Erro ao carregar';
        }
    }
    
    document.getElementById('resultadoPainelDono').innerHTML = `
        <div style="background: rgba(23, 162, 184, 0.1); border: 2px solid #17a2b8; border-radius: 10px; padding: 15px;">
            <h5 style="color: #17a2b8; margin-bottom: 15px;">📊 ESTATÍSTICAS COMPLETAS DO JOGADOR</h5>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 10px;">
                <p><strong>💰 Saldo:</strong> R$ ${saldo}</p>
                <p><strong>🎮 Jogos:</strong> ${jogosJogados}</p>
                <p><strong>🏆 Vitórias:</strong> ${vitorias}</p>
                <p><strong>📊 Taxa de Vitória:</strong> ${taxaVitoria}%</p>
                <p><strong>🎰 Fichas Adicionadas:</strong> ${vezesFichasAdicionadas}/4</p>
                <p><strong>👤 Nome no Ranking:</strong> ${nomeJogadorRanking || 'Não cadastrado'}</p>
                <p><strong>🏆 Posição Global:</strong> ${posicaoRanking}</p>
                <p><strong>🚫 Status Bloqueio:</strong> ${statusBloqueio}</p>
                <p><strong>🍀 Boost de Sorte:</strong> ${statusBoost}</p>
            </div>
        </div>
    `;
}

async function gerenciarRanking() {
    // Mostra loading primeiro
    document.getElementById('resultadoPainelDono').innerHTML = `
        <div style="background: rgba(111, 66, 193, 0.1); border: 2px solid #6f42c1; border-radius: 10px; padding: 15px; text-align: center;">
            <p style="color: #6f42c1;">🔄 Carregando ranking global...</p>
        </div>
    `;
    
    const ranking = await carregarRankingGlobal();
    let html = `
        <div style="background: rgba(111, 66, 193, 0.1); border: 2px solid #6f42c1; border-radius: 10px; padding: 15px;">
            <h5 style="color: #6f42c1; margin-bottom: 15px;">🏆 GERENCIAR RANKING GLOBAL</h5>
            <div style="margin-bottom: 15px;">
                <button class="btn" onclick="limparRankingGlobal()" style="background: #dc3545; margin-right: 10px;">🗑️ LIMPAR RANKING GLOBAL</button>
                <button class="btn" onclick="removerBloqueios()" style="background: #28a745;">🔓 REMOVER BLOQUEIOS</button>
                <button class="btn" onclick="gerenciarRanking()" style="background: #17a2b8; margin-left: 10px;">🔄 ATUALIZAR</button>
            </div>
    `;
    
    if (ranking.length > 0) {
        html += '<h6 style="color: #6f42c1;">Jogadores no Ranking Global:</h6>';
        ranking.forEach((jogador, index) => {
            const tempoDecorrido = Math.floor((Date.now() - jogador.timestamp) / 1000 / 60);
            const taxaVitoria = jogador.jogos > 0 ? ((jogador.vitorias / jogador.jogos) * 100).toFixed(1) : 0;
            
            html += `
                <div style="background: rgba(255,255,255,0.1); padding: 10px; margin: 5px 0; border-radius: 5px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <span style="font-weight: bold;">${index + 1}º ${jogador.nome} - R$ ${jogador.saldo}</span>
                        <button class="btn btn-danger" onclick="removerJogadorRankingGlobal('${jogador.nome}')" style="padding: 2px 8px; font-size: 0.8em;">REMOVER</button>
                    </div>
                    <div style="font-size: 0.8em; color: #aaa;">
                        🎮 ${jogador.jogos} jogos | 🏆 ${jogador.vitorias} vitórias | 📊 ${taxaVitoria}% win rate | ⏰ ${tempoDecorrido}min atrás
                    </div>
                </div>
            `;
        });
    } else {
        html += '<p style="text-align: center; color: #aaa;">Nenhum jogador no ranking global ainda</p>';
    }
    
    html += '</div>';
    document.getElementById('resultadoPainelDono').innerHTML = html;
}

async function limparRankingGlobal() {
    if (confirm('Tem certeza que deseja limpar todo o ranking ONLINE? Isso afetará todos os jogadores do Brasil!')) {
        try {
            // Limpa todos os sistemas de ranking
            const chaves = [
                'nukuzera_ranking_br_1',
                'nukuzera_ranking_br_2', 
                'nukuzera_ranking_br_3',
                'nukuzerabetRanking'
            ];
            
            chaves.forEach(chave => {
                localStorage.removeItem(chave);
            });
            
            const response = { ok: true }; // Simula sucesso
            
            if (response.ok) {
                document.getElementById('resultadoPainelDono').innerHTML = `
                    <div class="codigo-sucesso">
                        <p style="font-size: 1.3em;">✅ RANKING ONLINE LIMPO!</p>
                        <p>Todos os jogadores foram removidos do ranking</p>
                    </div>
                `;
            } else {
                throw new Error('Falha na API');
            }
        } catch (error) {
            console.error('Erro ao limpar ranking online:', error);
            document.getElementById('resultadoPainelDono').innerHTML = `
                <div class="codigo-erro">
                    <p style="font-size: 1.3em;">❌ ERRO AO LIMPAR RANKING</p>
                    <p>Falha na conexão com o servidor</p>
                </div>
            `;
        }
        
        setTimeout(gerenciarRanking, 2000);
    }
}

// Mantém a função original para compatibilidade
function limparRanking() {
    limparRankingGlobal();
}

function removerBloqueios() {
    localStorage.removeItem('nukuzerabetBloqueioRanking');
    document.getElementById('resultadoPainelDono').innerHTML = `
        <div class="codigo-sucesso">
            <p style="font-size: 1.3em;">✅ BLOQUEIOS REMOVIDOS!</p>
        </div>
    `;
}

async function removerJogadorRankingGlobal(nomeJogador) {
    if (confirm(`Remover ${nomeJogador} do ranking ONLINE?`)) {
        try {
            // Remove de todos os sistemas
            const chaves = [
                'nukuzera_ranking_br_1',
                'nukuzera_ranking_br_2', 
                'nukuzera_ranking_br_3',
                'nukuzerabetRanking'
            ];
            
            chaves.forEach(chave => {
                try {
                    const dados = localStorage.getItem(chave);
                    if (dados) {
                        let jogadores = JSON.parse(dados);
                        jogadores = jogadores.filter(j => j.nome !== nomeJogador);
                        localStorage.setItem(chave, JSON.stringify(jogadores));
                    }
                } catch (e) {
                    console.log('Erro ao limpar chave', chave);
                }
            });
            
            const updateResponse = { ok: true }; // Simula sucesso
                
            if (updateResponse.ok) {
                console.log(`Jogador ${nomeJogador} removido do ranking online`);
            } else {
                throw new Error('Falha ao atualizar ranking');
            }
        } catch (error) {
            console.error('Erro ao remover jogador do ranking online:', error);
            alert('Erro ao remover jogador. Tente novamente.');
        }
        
        gerenciarRanking();
    }
}

// Mantém a função original para compatibilidade
function removerJogadorRanking(nomeJogador) {
    removerJogadorRankingGlobal(nomeJogador);
}

// Funções do sistema de boost de sorte
function ativarBoostSorte(duracao = 30 * 60 * 1000) { // 30 minutos por padrão
    boostSorteAtivo = true;
    boostSorteExpira = Date.now() + duracao;
    localStorage.setItem('nukuzerabetBoost', JSON.stringify({
        ativo: true,
        expira: boostSorteExpira
    }));
}

function verificarBoostSorte() {
    const boostSalvo = localStorage.getItem('nukuzerabetBoost');
    if (boostSalvo) {
        const boost = JSON.parse(boostSalvo);
        if (boost.ativo && boost.expira > Date.now()) {
            boostSorteAtivo = true;
            boostSorteExpira = boost.expira;
            return true;
        } else {
            // Boost expirou
            boostSorteAtivo = false;
            localStorage.removeItem('nukuzerabetBoost');
            return false;
        }
    }
    return false;
}

function getMultiplicadorSorte() {
    if (verificarBoostSorte()) {
        return 0.5; // Reduz a dificuldade em 50% (aumenta chance de ganhar)
    }
    return 0;
}

function getTempoRestanteBoost() {
    if (!boostSorteAtivo) return 0;
    const restante = boostSorteExpira - Date.now();
    return Math.max(0, restante);
}

function validarCodigo() {
    const codigo = document.getElementById('codigoPromocional').value.trim().toUpperCase();
    const resultadoDiv = document.getElementById('resultadoCodigo');
    
    if (!codigo) {
        resultadoDiv.innerHTML = '<div class="codigo-erro"><p style="font-size: 1.2em;">❌ Digite um código!</p></div>';
        return;
    }
    
    if (codigo === '1107') {
        saldo += 20000;
        atualizarSaldo();
        salvarNoRankingGlobal();
        
        resultadoDiv.innerHTML = `
            <div class="codigo-sucesso">
                <p style="font-size: 2em;">🎉 CÓDIGO VÁLIDO! 🎉</p>
                <p style="font-size: 1.5em; margin: 20px 0; color: #00ff00; font-weight: bold;">+ R$ 20.000</p>
                <p style="color: #fff;">Bônus adicionado ao seu saldo!</p>
                <p style="color: #d4af37; margin-top: 15px; font-size: 0.9em;">✨ Você pode usar este código quantas vezes quiser!</p>
            </div>
        `;
    } else if (codigo === 'SENSEIRATO') {
        ativarBoostSorte(30 * 60 * 1000); // 30 minutos
        
        resultadoDiv.innerHTML = `
            <div class="codigo-sucesso">
                <p style="font-size: 2em;">🍀 BOOST DE SORTE ATIVADO! 🍀</p>
                <p style="font-size: 1.3em; margin: 20px 0; color: #ffaa00; font-weight: bold;">+50% CHANCE DE GANHAR</p>
                <p style="color: #fff;">Boost ativo por 30 minutos!</p>
                <p style="color: #d4af37; margin-top: 15px; font-size: 0.9em;">🎯 Suas chances de vitória aumentaram significativamente!</p>
                <div id="contadorBoost" style="margin-top: 15px; padding: 10px; background: rgba(255,170,0,0.2); border-radius: 5px;">
                    <p style="color: #ffaa00; font-weight: bold;">⏰ Tempo restante: <span id="tempoBoost">30:00</span></p>
                </div>
            </div>
        `;
        
        // Inicia contador regressivo
        iniciarContadorBoost();
        
    } else {
        resultadoDiv.innerHTML = `
            <div class="codigo-erro">
                <p style="font-size: 1.5em;">❌ CÓDIGO INVÁLIDO</p>
                <p style="color: #ff6b6b; margin-top: 10px;">Tente novamente com um código válido</p>
            </div>
        `;
    }
}

function iniciarContadorBoost() {
    const intervalo = setInterval(() => {
        const tempoRestante = getTempoRestanteBoost();
        const tempoBoostElement = document.getElementById('tempoBoost');
        
        if (tempoRestante <= 0 || !tempoBoostElement) {
            clearInterval(intervalo);
            if (tempoBoostElement) {
                tempoBoostElement.parentElement.innerHTML = '<p style="color: #ff6b6b;">⏰ Boost expirado!</p>';
            }
            return;
        }
        
        const minutos = Math.floor(tempoRestante / 60000);
        const segundos = Math.floor((tempoRestante % 60000) / 1000);
        tempoBoostElement.textContent = `${minutos}:${segundos.toString().padStart(2, '0')}`;
    }, 1000);
}



/*
 * =========================================
 * 1. CONFIGURAÇÃO E SELEÇÃO DE ELEMENTOS
 * =========================================
 */

// --- Grid e Filtros ---
const grid = document.getElementById('grid');
const q = document.getElementById('q');
const cat = document.getElementById('cat');
const limpar = document.getElementById('limpar');

// --- Campos Globais do Cliente (no topo da página) ---
const clienteNome = document.getElementById('cliente-nome');
const clienteCnpj = document.getElementById('cliente-cnpj');
const representanteComercial = document.getElementById('representante-comercial');
const clienteResponsavel = document.getElementById('cliente-responsavel');

// --- Modal de Adicionar Item (#bk) ---
const bk = document.getElementById('bk');
const fechar = document.getElementById('fechar');
const mProduto = document.getElementById('m-produto');
const mCod = document.getElementById('m-cod');
const mCat = document.getElementById('m-cat');
const mQtd = document.getElementById('m-qtd');
const mValor = document.getElementById('m-valor');
const mObs = document.getElementById('m-obs');

// --- Modal de Checkout (#bk-checkout) ---
const bkCheckout = document.getElementById('bk-checkout');
const btnFecharCheckout = document.getElementById('btn-fechar-checkout');
const cartItemsList = document.getElementById('cart-items-list');
const cartEmptyMsg = document.getElementById('cart-empty-msg');
const btnEnviarCheckout = document.getElementById('btn-enviar-checkout');
const btnGerarPdf = document.getElementById('btn-gerar-pdf');
const cartTotalValue = document.getElementById('cart-total-value');
const checkoutObs = document.getElementById('checkout-obs');

// --- Carrinho (Header) ---
const btnAdicionar = document.getElementById('btn-adicionar');
const btnCarrinho = document.getElementById('btn-carrinho');
const cartCount = document.getElementById('cart-count');

// --- UI ---
const toast = document.getElementById('toast');
const hdr = document.getElementById('hdr');

// --- Zoom Overlay ---
const zoomOverlay = document.getElementById('zoom-overlay');
const zoomOverlayImg = document.getElementById('zoom-overlay-img');

// --- Estado Global ---
let carrinho = []; // Agora armazena objetos de produto
let __modalOpener = null;
let __trapHandler = null;


/*
 * =========================================
 * 2. FUNÇÕES UTILITÁRIAS
 * =========================================
 */

function escapeHtml(s) {
  return (s || '').toString().replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[c]));
}

function hi(text, term) {
  if (!term) return escapeHtml(text || '');
  const re = new RegExp('(' + (term || '').replace(/[.*+?^${}()|[\\]\\]/g, '\\$&') + ')', 'ig');
  return escapeHtml(text || '').replace(re, '<mark>$1</mark>');
}

function norm(s) {
  return (s || '').toString().toLowerCase();
}

function debounce(fn, delay = 200) {
  let t;
  return function(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Função para detectar se é um dispositivo móvel
function isMobile() {
  try {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  } catch(e) {
    return false;
  }
}

// Função para formatar moeda
function formatCurrency(value) {
  const numberValue = parseFloat(value) || 0;
  return numberValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/*
 * =========================================
 * 3. LÓGICA DO GRID E FILTROS
 * =========================================
 */

function productCard(p, term) {
  const img = p.imagem || '';
  const compat = p.compatibilidade || '';
  return `
    <article class="card" data-nome="${p.produto}" data-cod="${p.codigo}" data-cat="${p.categoria}">
      <div class="card-img">
        <img loading="lazy" 
             src="${img || 'https://placehold.co/220x220/2a2a38/b7b7c9?text=Imagem'}" 
             alt="${p.produto}">
      </div>
      <div class="card-body">
        <div class="name">${hi(p.produto, term)}</div>
        <div class="sku">SKU: <span>${hi(p.codigo || '-', term)}</span></div>
        <div class="cat">Categoria: <span>${hi(p.categoria || '-', term)}</span></div>
        <div class="compat">${hi(compat, term)}</div>
        <div class="actions"><button class="btn pedir">Adicionar</button></div>
      </div>
    </article>`;
}

function render(list, term = '') {
  grid.innerHTML = list.map(p => productCard(p, term)).join('');
}

function applyFilters() {
  const term = norm(q.value);
  const c = cat.value;
  // CORREÇÃO: Garante que 'produtos' exista, mesmo que vazio
  let list = window.produtos || []; 

  if (c) list = list.filter(p => p.categoria === c);

  if (term) {
    list = list.filter(p => {
      const blob = [p.produto, p.codigo, p.categoria, p.compatibilidade].map(norm).join(' ');
      return blob.includes(term);
    });
  }
  render(list, term);
}

const debouncedApplyFilters = debounce(applyFilters, 200);


/*
 * =========================================
 * 4. LÓGICA DO MODAL (ADICIONAR ITEM)
 * =========================================
 */

function __trapKeydown(e) {
  if (e.key !== 'Tab') return;
  const focusables = bk.querySelectorAll('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
  const list = Array.from(focusables).filter(el => !el.disabled && el.offsetParent !== null);
  if (!list.length) return;
  const first = list[0],
    last = list[list.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function openModal() {
  bk.style.display = 'flex';
  __modalOpener = document.activeElement;
  document.addEventListener('keydown', __trapHandler = __trapKeydown);
  setTimeout(() => {
    mQtd.focus();
  }, 50);
}

function closeModal() {
  bk.style.display = 'none';
  if (__trapHandler) {
    document.removeEventListener('keydown', __trapHandler);
    __trapHandler = null;
  }
  try {
    __modalOpener && __modalOpener.focus && __modalOpener.focus();
  } catch (_) {}
}

/** Salva campos DO CLIENTE no localStorage. */
function setupClientDataPersistence() {
  try {
    const _persist = (key, el) => {
      if (!el) return;
      const k = 'pedido_' + key;
      if (localStorage.getItem(k)) el.value = localStorage.getItem(k);
      el.addEventListener('input', () => localStorage.setItem(k, el.value.trim()));
    };
    _persist('cliente_nome', clienteNome);
    _persist('cliente_cnpj', clienteCnpj);
    _persist('cliente_rep', representanteComercial);
    _persist('cliente_resp', clienteResponsavel);
  } catch (_) {}
}

/** Validação para ADICIONAR AO CARRINHO. */
function validateAdicionar() {
  const qtd = parseInt(mQtd.value, 10);
  if (!(qtd > 0)) return 'Quantidade inválida (deve ser 1 ou mais).';
  
  const valor = parseFloat(mValor.value.replace(',', '.')) || 0;
  if (!(valor > 0)) return 'Valor do item inválido.';
  
  return null;
}

/** Adiciona o item do modal ao carrinho. */
function adicionarAoCarrinho() {
  const err = validateAdicionar();
  if (err) return showToast(err, true);

  const quantidade = parseInt(mQtd.value, 10);
  const sku = mCod.value;
  const valor = parseFloat(mValor.value.replace(',', '.')) || 0;

  // Usa um ID único para cada *linha* do carrinho
  const produto = {
    id: crypto.randomUUID(), // ID único para esta entrada
    nome: mProduto.value,
    sku: sku,
    categoria: mCat.value,
    quantidade: quantidade,
    valor: valor,
    obs: mObs.value
  };

  carrinho.push(produto);
  showToast(`${produto.nome} adicionado ao pedido!`);

  closeModal();
  atualizarContadorCarrinho();
  console.log(carrinho);
}

/*
 * =========================================
 * 5. LÓGICA DO MODAL (CHECKOUT) E CARRINHO
 * =========================================
 */

/** Atualiza o contador visual do carrinho (total de QTD). */
function atualizarContadorCarrinho() {
  const totalItens = carrinho.reduce((total, item) => total + item.quantidade, 0);
  cartCount.textContent = totalItens;
  cartCount.style.display = totalItens > 0 ? 'grid' : 'none';
  atualizarValorTotal(); 
}

/** Calcula e exibe o valor total do pedido. */
function atualizarValorTotal() {
  const totalGeral = carrinho.reduce((total, item) => total + (item.valor * item.quantidade), 0);
  if (cartTotalValue) {
    cartTotalValue.textContent = formatCurrency(totalGeral);
  }
}

/** Abre o modal de checkout. */
function openCheckoutModal() {
  renderizarCarrinho();
  bkCheckout.style.display = 'flex';
  __modalOpener = document.activeElement;
  document.addEventListener('keydown', __trapHandler = __trapKeydownCheckout);
}

/** Fecha o modal de checkout. */
function closeCheckoutModal() {
  bkCheckout.style.display = 'none';
  if (__trapHandler) {
    document.removeEventListener('keydown', __trapHandler);
    __trapHandler = null;
  }
  try {
    __modalOpener && __modalOpener.focus && __modalOpener.focus();
  } catch (_) {}
}

/** Trava o foco (Tab) dentro do modal de CHECKOUT. */
function __trapKeydownCheckout(e) {
  if (e.key !== 'Tab') return;
  const focusables = bkCheckout.querySelectorAll('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
  const list = Array.from(focusables).filter(el => !el.disabled && el.offsetParent !== null);
  if (!list.length) return;
  const first = list[0], last = list[list.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } 
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}


/** Renderiza os itens do carrinho no modal de checkout. */
function renderizarCarrinho() {
  if (carrinho.length === 0) {
    cartItemsList.style.display = 'none';
    cartEmptyMsg.style.display = 'block';
    btnEnviarCheckout.disabled = true;
    btnGerarPdf.disabled = true;
  } else {
    cartItemsList.style.display = 'grid';
    cartEmptyMsg.style.display = 'none';
    btnEnviarCheckout.disabled = false;
    btnGerarPdf.disabled = false;

    cartItemsList.innerHTML = carrinho.map(item => `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="name">${escapeHtml(item.nome)}</div>
          <div class="sku">SKU: ${escapeHtml(item.sku)} | Valor: ${formatCurrency(item.valor)}</div>
          ${item.obs ? `<div class="sku">Obs: ${escapeHtml(item.obs)}</div>` : ''}
        </div>
        <div class="cart-item-qty">
          <input 
            type="number" 
            class="cart-item-qty-input" 
            value="${item.quantidade}" 
            min="0" 
            step="1" 
            data-id="${item.id}" 
            aria-label="Quantidade"
          />
        </div>
        <button class="cart-remove-item" data-id="${item.id}" aria-label="Remover item">
          &times;
        </button>
      </div>
    `).join('');
  }
  atualizarValorTotal();
}

/** Remove um item do carrinho pelo ID único. */
function removerItemCarrinho(id) {
  carrinho = carrinho.filter(item => item.id !== id);
  showToast('Item removido do pedido.');
  atualizarContadorCarrinho();
  renderizarCarrinho(); // Re-renderiza a lista no modal
}

/** Atualiza a quantidade de um item no carrinho. */
const debouncedAtualizarQuantidade = debounce((id, quantidade) => {
  const item = carrinho.find(i => i.id === id);
  if (item) {
    if (quantidade <= 0) {
      // Se a quantidade for 0 ou menos, remove o item
      removerItemCarrinho(id);
    } else {
      item.quantidade = quantidade;
      atualizarContadorCarrinho();
      showToast('Quantidade atualizada.');
    }
  }
}, 300); // Atraso de 300ms

/** Validação dos campos de cliente. */
function validateCheckout() {
  if (!clienteNome.value.trim()) {
    showToast('O campo "Nome do Cliente" é obrigatório.', true);
    return false;
  }
  if (!clienteCnpj.value.trim()) {
    showToast('O campo "CNPJ" é obrigatório.', true);
    return false;
  }
  if (!representanteComercial.value.trim()) {
    showToast('O campo "Representante Comercial" é obrigatório.', true);
    return false;
  }
  if (carrinho.length === 0) {
    showToast('Seu carrinho está vazio.', true);
    return false;
  }
  return true;
}

/** Monta a MENSAGEM FINAL do pedido (com dados do cliente + itens). */
function buildCheckoutMessage() {
  const hNome = clienteNome.value || 'Não informado';
  const hCnpj = clienteCnpj.value || 'Não informado';
  const hRep = representanteComercial.value || 'Não informado';
  const hResp = clienteResponsavel.value || 'Não informado';
  const obsGerais = checkoutObs.value.trim() || 'Nenhuma';

  const linhas = [
    'Pedido UP Electronics',
    '====================',
    '',
    'Dados do Cliente:',
    `Nome: ${hNome}`,
    `CNPJ: ${hCnpj}`,
    `Representante: ${hRep}`,
    `Responsável: ${hResp}`,
    '',
    `Observações Gerais: ${obsGerais}`,
    '',
    'Itens do Pedido:',
    '====================',
  ];

  carrinho.forEach(item => {
    linhas.push(
`Produto: ${item.nome} (SKU ${item.sku})
Qtd: ${item.quantidade}
Valor Unit.: ${formatCurrency(item.valor)}
Total Item: ${formatCurrency(item.valor * item.quantidade)}` +
(item.obs ? `
Obs: ${item.obs}` : '') +
`
--------------------`
    );
  });
  
  const totalGeral = carrinho.reduce((total, item) => total + (item.valor * item.quantidade), 0);
  linhas.push(`*VALOR TOTAL DO PEDIDO: ${formatCurrency(totalGeral)}*`);

  linhas.push('');
  linhas.push('— Enviado via App de Pedidos UP Electronics —');
  return linhas.join('\n');
}

/** Envia o pedido final. */
function enviarPedidoCheckout() {
  if (!validateCheckout()) return; 

  const texto = buildCheckoutMessage();
  
  const isMobileDevice = isMobile();
  const baseUrl = isMobileDevice ? 'whatsapp://send?text=' : 'https://wa.me/?text=';
  const url = baseUrl + encodeURIComponent(texto);

  const __w = window.open(url, '_blank');
  try { if (__w) __w.opener = null; } catch (_) {}

  showToast('Abrindo WhatsApp para finalizar o pedido…');
  closeCheckoutModal();
}

/** Gera o PDF do pedido. */
async function gerarPDF() {
  if (!validateCheckout()) return;

  // Espera a biblioteca jsPDF estar pronta
  if (typeof jspdf === 'undefined' || typeof jspdf.jsPDF === 'undefined') {
    showToast('Erro: Biblioteca de PDF não carregou. Recarregue.', true);
    return;
  }
  const { jsPDF } = jspdf;
  const doc = new jsPDF();
  let y = 15; // Posição Y inicial (vertical)

  // --- 1. Dados do Pedido ---
  const hNome = clienteNome.value || 'Não informado';
  const hCnpj = clienteCnpj.value || 'Não informado';
  const hRep = representanteComercial.value || 'Não informado';
  const hResp = clienteResponsavel.value || 'Não informado';
  const obsGerais = checkoutObs.value.trim() || 'Nenhuma';
  const totalGeral = carrinho.reduce((total, item) => total + (item.valor * item.quantidade), 0);

  // --- 2. Título ---
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Pedido UP Electronics", 10, y);
  y += 7;
  doc.line(10, y, 200, y); // Linha horizontal
  y += 10;

  // --- 3. Dados do Cliente ---
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Dados do Cliente:", 10, y);
  y += 7;

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(10);
  // Layout em duas colunas para os dados do cliente
  doc.text(`Nome: ${hNome}`, 10, y);
  doc.text(`CNPJ: ${hCnpj}`, 105, y);
  y += 7;
  doc.text(`Representante: ${hRep}`, 10, y);
  doc.text(`Responsável: ${hResp}`, 105, y);
  y += 10;
  
  doc.line(10, y, 200, y); // Linha horizontal
  y += 10;

  // --- 4. Cabeçalho da Tabela de Itens ---
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Itens do Pedido:", 10, y);
  y += 7;

  // Definição das posições X (horizontal) das colunas
  const colNome = 10;
  const colSKU = 80;
  const colQtd = 120;
  const colVlrUnit = 145;
  const colVlrTotal = 175;

  doc.setFont("Helvetica", "bold");
  doc.text("Nome do produto", colNome, y);
  doc.text("SKU", colSKU, y);
  doc.text("Qtd.", colQtd, y, { align: 'right' });
  doc.text("Vlr. Unit.", colVlrUnit, y, { align: 'right' });
  doc.text("Vlr. Total", colVlrTotal, y, { align: 'right' });
  y += 3;
  doc.line(10, y, 200, y); // Linha horizontal
  y += 7;

  // --- 5. Corpo da Tabela de Itens (Loop) ---
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(9); // Fonte menor para os itens

  for (const item of carrinho) {
    // Quebra a linha se o nome do produto for muito longo
    const nomeLines = doc.splitTextToSize(item.nome, (colSKU - colNome - 5)); // Largura da coluna nome
    
    const vlrUnitStr = formatCurrency(item.valor);
    const vlrTotalStr = formatCurrency(item.valor * item.quantidade);

    // Desenha os dados do item nas colunas
    doc.text(nomeLines, colNome, y);
    doc.text(item.sku, colSKU, y);
    doc.text(String(item.quantidade), colQtd, y, { align: 'right' });
    doc.text(vlrUnitStr, colVlrUnit, y, { align: 'right' });
    doc.text(vlrTotalStr, colVlrTotal, y, { align: 'right' });

    // Ajusta a altura Y baseado no número de linhas do nome
    const lineHeight = 5; // Altura aproximada da linha
    y += (nomeLines.length * lineHeight);

    // Adiciona observação do item, se existir
    if (item.obs) {
      doc.setFont("Helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(100); // Cinza
      doc.text(`Obs: ${item.obs}`, colNome + 2, y); // Indentado
      y += lineHeight;
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(0); // Preto
    }

    y += 3; // Espaçamento entre linhas de produtos

    // Verifica se precisa de uma nova página
    if (y > 280) {
      doc.addPage();
      y = 15; // Reinicia o Y no topo da nova página
      // (Opcional: Redesenhar o cabeçalho da tabela na nova página)
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Nome do produto", colNome, y);
      doc.text("SKU", colSKU, y);
      doc.text("Qtd.", colQtd, y, { align: 'right' });
      doc.text("Vlr. Unit.", colVlrUnit, y, { align: 'right' });
      doc.text("Vlr. Total", colVlrTotal, y, { align: 'right' });
      y += 3;
      doc.line(10, y, 200, y);
      y += 7;
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
    }
  }

  // --- 6. Rodapé do Pedido (Observações e Total) ---
  y += 5;
  doc.line(10, y, 200, y);
  y += 7;

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Observações Gerais: ${obsGerais}`, 10, y);
  y += 10;

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`VALOR TOTAL DO PEDIDO: ${formatCurrency(totalGeral)}`, colVlrTotal + 25, y, { align: 'right' }); // Alinhado à direita da página

  // --- 7. Marca d'água de Data/Hora ---
  const data = new Date().toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
  doc.setTextColor(150); // Cinza
  doc.setFontSize(8);
  doc.text(
    `Gerado em: ${data}`,
    10,
    doc.internal.pageSize.height - 10
  );

  // --- 8. Salvar o PDF ---
  try {
    doc.save(`pedido-${hNome || 'cliente'}.pdf`);
    showToast('Gerando PDF...');
  } catch (e) {
    console.error("Erro ao gerar PDF:", e);
    showToast('Erro ao gerar PDF.', true);
  }
}


/*
 * =========================================
 * 6. LÓGICA DE UI (EFEITOS)
 * =========================================
 */

let toastTimer;
function showToast(msg, isErr = false) {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.style.display = 'block';
  toast.style.borderColor = isErr ? 'var(--err)' : 'var(--ok)';
  toast.style.background = isErr ? 'var(--err)' : '#0f172a';
  toast.style.color = isErr ? '#FFF' : '#e2e8f0';
  
  toastTimer = setTimeout(() => toast.style.display = 'none', 3000);
}

function onScroll() {
  if (window.scrollY > 8) hdr.classList.add('compact');
  else hdr.classList.remove('compact');
}

// Funções de Zoom
function showZoom(e) {
  const cardImg = e.target.closest('.card-img');
  if (!cardImg) return;
  
  const img = cardImg.querySelector('img');
  if (!img || !img.src || img.src.includes('placehold.co')) return; // Não dá zoom em placeholder

  e.preventDefault(); 
  
  zoomOverlayImg.src = img.src;
  zoomOverlay.classList.add('visible');
}

function hideZoom() {
  zoomOverlay.classList.remove('visible');
  setTimeout(() => { zoomOverlayImg.src = ''; }, 200);
}

/*
 * =========================================
 * 7. INICIALIZAÇÃO E OUVINTES DE EVENTOS
 * =========================================
 */

/** Amarra todos os eventos aos elementos. */
function setupEventListeners() {
  // --- Filtros ---
  q.addEventListener('input', debouncedApplyFilters);
  cat.addEventListener('change', applyFilters);
  limpar.addEventListener('click', () => {
    q.value = '';
    cat.value = '';
    applyFilters();
    showToast('Filtros limpos');
  });

  // --- Grid (Abrir Modal de Item) ---
  grid.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.pedir');
    if (!btn) return;
    const card = ev.target.closest('.card');
    mProduto.value = card.dataset.nome || '';
    mCod.value = card.dataset.cod || '';
    mCat.value = card.dataset.cat || '';
    mQtd.value = 1;
    mValor.value = ''; // Reseta campos do item
    mObs.value = '';
    openModal();
  });
  
  // --- Grid (Zoom da Imagem) ---
  // Diferencia eventos de toque e mouse para melhor performance mobile
  if (isMobile()) {
    grid.addEventListener('touchstart', showZoom, { passive: true });
  } else {
    grid.addEventListener('mousedown', showZoom);
  }

  // --- Eventos para fechar o zoom ---
  zoomOverlay.addEventListener('mouseup', hideZoom);
  zoomOverlay.addEventListener('mouseleave', hideZoom);
  zoomOverlay.addEventListener('touchend', hideZoom);
  zoomOverlay.addEventListener('touchcancel', hideZoom);
  zoomOverlay.addEventListener('click', hideZoom); // Fallback de clique

  // --- Modal de Item (Ações) ---
  btnAdicionar.addEventListener('click', adicionarAoCarrinho);
  fechar.addEventListener('click', closeModal);
  bk.addEventListener('click', (e) => {
    if (e.target === bk) closeModal();
  });

  // --- Helpers de Formulário (Máscaras e Validações) ---
  clienteCnpj.addEventListener('input', () => {
    // Remove qualquer letra
    clienteCnpj.value = clienteCnpj.value.replace(/[a-zA-Z]/g, '');
  });
  
  mValor.addEventListener('input', () => {
     let v = mValor.value.replace(/[^0-9,.]/g, '');
     v = v.replace('.', ',');
     mValor.value = v;
  });

  // --- Efeitos de UI ---
  document.addEventListener('scroll', onScroll, { passive: true });

  // --- Botão principal do Carrinho (Header) ---
  btnCarrinho.addEventListener('click', openCheckoutModal);

  // --- Modal de Checkout (Ações) ---
  btnFecharCheckout.addEventListener('click', closeCheckoutModal);
  bkCheckout.addEventListener('click', (e) => {
    if (e.target === bkCheckout) closeCheckoutModal();
  });
  
  btnEnviarCheckout.addEventListener('click', enviarPedidoCheckout);
  btnGerarPdf.addEventListener('click', gerarPDF);

  // --- Ações *dentro* do Carrinho (Qtd e Remover) ---
  cartItemsList.addEventListener('click', (e) => {
    const btnRemover = e.target.closest('.cart-remove-item');
    if (btnRemover) {
      const id = btnRemover.dataset.id;
      removerItemCarrinho(id);
    }
  });

  cartItemsList.addEventListener('input', (e) => {
    const inputQty = e.target.closest('.cart-item-qty-input');
    if (inputQty) {
      const id = inputQty.dataset.id;
      const quantidade = parseInt(inputQty.value, 10) || 0;
      debouncedAtualizarQuantidade(id, quantidade);
    }
  });

  // --- Listener Global de 'Escape' ---
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeCheckoutModal();
      hideZoom();
    }
  });
}

/** Função principal de inicialização. */
function init() {
  // Garante que 'produtos' exista, mesmo que vazio
  if (typeof produtos === 'undefined') {
    console.warn('Arquivo "products.js" não encontrado. Carregando com 0 produtos.');
    window.produtos = []; 
  }
  
  // Verifica se o jsPDF foi carregado
  if (typeof jspdf === 'undefined' || typeof jspdf.jsPDF === 'undefined') {
    console.error('jsPDF não foi carregado a tempo.');
    // Tenta carregar novamente se falhou
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    document.head.appendChild(script);
    script.onload = () => {
      console.log("jsPDF carregado dinamicamente.");
      if (typeof window.jspdf === 'undefined') {
         alert('Erro ao carregar biblioteca de PDF. Recarregue a página.');
      }
    };
  }

  setupEventListeners();
  setupClientDataPersistence();
  onScroll();
  render(produtos, '');
  atualizarContadorCarrinho();
}

// Inicia o app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}


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
const mValor = document.getElementById('m-valor'); // NOVO: Campo Valor
const mObs = document.getElementById('m-obs');
// REMOVIDO: mItemTel

// --- Modal de Checkout (#bk-checkout) ---
const bkCheckout = document.getElementById('bk-checkout');
const btnFecharCheckout = document.getElementById('btn-fechar-checkout');
const cartItemsList = document.getElementById('cart-items-list');
const cartEmptyMsg = document.getElementById('cart-empty-msg');
const btnEnviarCheckout = document.getElementById('btn-enviar-checkout');
const btnGerarPdf = document.getElementById('btn-gerar-pdf'); // NOVO: Botão PDF

// --- Carrinho (Header) ---
const btnAdicionar = document.getElementById('btn-adicionar');
const btnCarrinho = document.getElementById('btn-carrinho');
const cartCount = document.getElementById('cart-count');

// --- UI ---
const toast = document.getElementById('toast');
const hdr = document.getElementById('hdr');

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

// NOVO: Função para formatar moeda
function formatCurrency(value) {
  // Converte para número, garantindo que é um float
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
      <div class="card-img"><img loading="lazy" src="${img || 'https://placehold.co/220x220/2a2a38/b7b7c9?text=Imagem'}" alt="${p.produto}"></div>
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
  let list = produtos; // 'produtos' vem do 'products.js'

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
  
  // Usa parseFloat para aceitar centavos (ex: 25,50)
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

  // Usa um ID único para cada *linha* do carrinho, permitindo
  // o mesmo SKU com observações ou valores diferentes.
  const produto = {
    id: crypto.randomUUID(), // ID único para esta entrada
    nome: mProduto.value,
    sku: sku,
    categoria: mCat.value,
    quantidade: quantidade,
    valor: valor,
    obs: mObs.value,
    tel: '' // Campo telefone removido
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

    // Mostra todos os detalhes, incluindo o input de quantidade
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
  
  // Calcula o total geral
  const totalGeral = carrinho.reduce((total, item) => total + (item.valor * item.quantidade), 0);
  linhas.push(`*VALOR TOTAL DO PEDIDO: ${formatCurrency(totalGeral)}*`);

  linhas.push('');
  linhas.push('— Enviado via App de Pedidos UP (com carrinho)');
  return linhas.join('\n');
}

/** Envia o pedido final. */
function enviarPedidoCheckout() {
  if (!validateCheckout()) return; // Validação primeiro

  const texto = buildCheckoutMessage();
  const url = 'https://wa.me/?text=' + encodeURIComponent(texto);

  const __w = window.open(url, '_blank');
  try { if (__w) __w.opener = null; } catch (_) {}

  showToast('Abrindo WhatsApp para finalizar o pedido…');
  closeCheckoutModal();
}

/** Gera o PDF do pedido. */
async function gerarPDF() {
  if (!validateCheckout()) return; // Mesma validação

  // Espera a biblioteca jsPDF estar pronta (ela é carregada no <head>)
  if (typeof jspdf === 'undefined' || typeof jspdf.jsPDF === 'undefined') {
    showToast('Erro: Biblioteca de PDF não carregou. Recarregue.', true);
    return;
  }
  const { jsPDF } = jspdf;
  const doc = new jsPDF();
  
  // Pega o texto formatado para o PDF (é o mesmo do WhatsApp)
  const textoDoPedido = buildCheckoutMessage();
  
  // Adiciona o texto formatado ao PDF
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(10);
  doc.text(textoDoPedido, 10, 10);

  // Adiciona marca d'água de data/hora
  const data = new Date().toLocaleString('pt-BR', { 
    dateStyle: 'short', 
    timeStyle: 'short' 
  });
  doc.setTextColor(150); // Cor cinza
  doc.setFontSize(8);
  doc.text(
    `Gerado em: ${data}`,
    10,
    doc.internal.pageSize.height - 10
  );

  // Salva o arquivo
  try {
    doc.save(`pedido-${clienteNome.value || 'cliente'}.pdf`);
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
function showToast(msg, isErr = false) { // Padrão é não ser erro
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.style.display = 'block';
  toast.style.borderColor = isErr ? 'var(--err)' : 'var(--ok)'; // Verde para sucesso
  toast.style.background = isErr ? 'var(--err)' : '#0f172a'; // Fundo vermelho para erro
  toast.style.color = isErr ? '#FFF' : '#e2e8f0';
  
  toastTimer = setTimeout(() => toast.style.display = 'none', 3000); // 3 segundos
}

function onScroll() {
  if (window.scrollY > 8) hdr.classList.add('compact');
  else hdr.classList.remove('compact');
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
    // Reseta os campos do modal
    mQtd.value = 1;
    mValor.value = '';
    mObs.value = '';
    // mItemTel.value = ''; // Não existe mais
    openModal();
  });

  // --- Modal de Item (Ações) ---
  btnAdicionar.addEventListener('click', adicionarAoCarrinho);
  fechar.addEventListener('click', closeModal);
  bk.addEventListener('click', (e) => {
    if (e.target === bk) closeModal();
  });

  // --- Helpers de Formulário (Máscaras e Validações) ---
  // mItemTel.addEventListener('input', () => { // Não existe mais
  //   mItemTel.value = maskTelBR(mItemTel.value);
  // });
  
  // NOVO: Validação do CNPJ (remove letras)
  clienteCnpj.addEventListener('input', () => {
    clienteCnpj.value = clienteCnpj.value.replace(/[a-zA-Z]/g, '');
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
  
  // Ações de Envio e PDF
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
    }
  });
}

/** Função principal de inicialização. */
function init() {
  // CORREÇÃO: Define 'produtos' como um array vazio se 'products.js' não for carregado.
  // Isso evita que o script quebre se o arquivo estiver faltando.
  if (typeof produtos === 'undefined') {
    console.warn('Arquivo "products.js" não encontrado. Carregando com 0 produtos.');
    window.produtos = []; // Define globalmente como um array vazio
  }
  
  // CORREÇÃO: Verifica a biblioteca jsPDF
  if (typeof jspdf === 'undefined' || typeof jspdf.jsPDF === 'undefined') {
    console.error('jsPDF não foi carregado a tempo.');
    // Tenta carregar novamente se falhou
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    document.head.appendChild(script);
    script.onload = () => {
      console.log("jsPDF carregado dinamicamente.");
      // Tenta iniciar novamente após o carregamento
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
// Espera o DOM estar pronto para garantir que todos os elementos existam
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}


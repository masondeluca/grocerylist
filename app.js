// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  items: [],       // { id, name, quantity, checked, categoryIds[] }
  categories: [],  // { id, name }
  meals: [],       // { id, name, items: [{ id, name, quantity, categoryIds[] }] }
  activeTab: 'grocery',
};

// ─── Persistence ──────────────────────────────────────────────────────────────

function loadState() {
  try {
    state.items      = JSON.parse(localStorage.getItem('groceryItems'))  || [];
    state.categories = JSON.parse(localStorage.getItem('categories'))    || [];
    state.meals      = JSON.parse(localStorage.getItem('meals'))         || [];
  } catch (e) {
    state.items = []; state.categories = []; state.meals = [];
  }
}

function saveState() {
  localStorage.setItem('groceryItems', JSON.stringify(state.items));
  localStorage.setItem('categories',   JSON.stringify(state.categories));
  localStorage.setItem('meals',        JSON.stringify(state.meals));
}

// ─── ID generation ────────────────────────────────────────────────────────────

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ─── CRUD: grocery items ──────────────────────────────────────────────────────

function addItem(name, quantity, categoryIds) {
  state.items.push({ id: newId(), name, quantity, checked: false, categoryIds });
  saveState();
}

function editItem(id, name, quantity, categoryIds) {
  const item = state.items.find(i => i.id === id);
  if (!item) return;
  item.name = name; item.quantity = quantity; item.categoryIds = categoryIds;
  saveState();
}

function removeItem(id) {
  state.items = state.items.filter(i => i.id !== id);
  saveState();
}

function clearList() {
  state.items = [];
  saveState();
}

function toggleItem(id) {
  const item = state.items.find(i => i.id === id);
  if (item) { item.checked = !item.checked; saveState(); }
}

// ─── CRUD: categories ─────────────────────────────────────────────────────────

function addCategory(name) {
  state.categories.push({ id: newId(), name });
  saveState();
}

function editCategory(id, name) {
  const cat = state.categories.find(c => c.id === id);
  if (cat) { cat.name = name; saveState(); }
}

function removeCategory(id) {
  state.categories = state.categories.filter(c => c.id !== id);
  state.items.forEach(item => {
    item.categoryIds = (item.categoryIds || []).filter(cid => cid !== id);
  });
  // Strip from meal items too
  state.meals.forEach(meal => {
    meal.items.forEach(mi => {
      mi.categoryIds = (mi.categoryIds || []).filter(cid => cid !== id);
    });
  });
  saveState();
}

// ─── CRUD: meals ──────────────────────────────────────────────────────────────

// Temporary items staged in the builder before a meal is saved
let builderItems = [];

function addMeal(name, items) {
  state.meals.push({ id: newId(), name, items: items.map(i => ({ ...i })) });
  saveState();
}

function editMeal(id, name) {
  const meal = state.meals.find(m => m.id === id);
  if (meal) { meal.name = name; saveState(); }
}

function removeMeal(id) {
  state.meals = state.meals.filter(m => m.id !== id);
  saveState();
}

function addMealItem(mealId, name, quantity, categoryIds) {
  const meal = state.meals.find(m => m.id === mealId);
  if (meal) { meal.items.push({ id: newId(), name, quantity, categoryIds: categoryIds || [] }); saveState(); }
}

function editMealItem(mealId, itemId, name, quantity, categoryIds) {
  const meal = state.meals.find(m => m.id === mealId);
  if (!meal) return;
  const item = meal.items.find(i => i.id === itemId);
  if (!item) return;
  item.name = name; item.quantity = quantity; item.categoryIds = categoryIds || [];
  saveState();
}

function removeMealItem(mealId, itemId) {
  const meal = state.meals.find(m => m.id === mealId);
  if (meal) { meal.items = meal.items.filter(i => i.id !== itemId); saveState(); }
}

function addMealToGroceryList(mealId, selectedItemIds) {
  const meal = state.meals.find(m => m.id === mealId);
  if (!meal) return;
  meal.items
    .filter(mi => selectedItemIds.includes(mi.id))
    .forEach(mi => addItem(mi.name, mi.quantity, mi.categoryIds || []));
}

// ─── Tab switching ────────────────────────────────────────────────────────────

function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.toggle('hidden', !el.id.endsWith(tab));
    el.classList.toggle('active', el.id.endsWith(tab));
  });
  render();
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Build a category picker widget (toggle button + hidden dropdown) as an HTML string.
// dropdownId must be unique on the page.
function buildCatPickerHtml(dropdownId, selectedIds = []) {
  const selected = selectedIds[0] || '';
  const optionsHtml = state.categories.length === 0
    ? '<span class="empty-note">No categories yet</span>'
    : `<label class="cat-check-label"><input type="radio" name="${dropdownId}" value="" ${selected === '' ? 'checked' : ''} />None</label>`
      + state.categories.map(cat => {
          const checked = cat.id === selected ? 'checked' : '';
          return `<label class="cat-check-label"><input type="radio" name="${dropdownId}" value="${cat.id}" ${checked} />${escHtml(cat.name)}</label>`;
        }).join('');
  return `
    <div class="category-picker-wrapper">
      <button type="button" class="btn-ghost cat-picker-toggle-btn" data-dropdown="${dropdownId}">Category</button>
      <div id="${dropdownId}" class="category-dropdown hidden">${optionsHtml}</div>
    </div>`;
}

// Collect selected category ID from a dropdown by its element ID.
function getCheckedCatIds(dropdownId) {
  const radio = document.querySelector(`#${dropdownId} input[type="radio"]:checked`);
  return radio && radio.value ? [radio.value] : [];
}

// Render small category tag pills for a list of category IDs.
function catTagsHtml(categoryIds) {
  const names = (categoryIds || [])
    .map(cid => state.categories.find(c => c.id === cid)?.name)
    .filter(Boolean);
  return names.length
    ? `<div class="item-cats">${names.map(n => `<span class="cat-tag">${escHtml(n)}</span>`).join('')}</div>`
    : '';
}

// ─── Render: grocery tab ──────────────────────────────────────────────────────

function renderCategoryBar() {
  const chips = document.getElementById('category-chips');
  chips.innerHTML = '';
  state.categories.forEach(cat => {
    const chip = document.createElement('span');
    chip.className = 'category-chip';
    chip.dataset.id = cat.id;
    chip.innerHTML = `
      <span class="chip-name" title="Click to rename">${escHtml(cat.name)}</span>
      <button class="btn-icon danger remove-cat-btn" title="Remove category">×</button>
    `;
    chips.appendChild(chip);
  });
}

function renderCategoryDropdown(containerId, selectedIds) {
  const dropdown = document.getElementById(containerId);
  if (!dropdown) return;
  dropdown.innerHTML = '';
  if (state.categories.length === 0) {
    dropdown.innerHTML = '<span class="empty-note">No categories yet</span>';
    return;
  }
  const selected = (selectedIds || [])[0] || '';
  const noneLabel = document.createElement('label');
  noneLabel.innerHTML = `<input type="radio" name="${containerId}" value="" ${selected === '' ? 'checked' : ''} /> None`;
  dropdown.appendChild(noneLabel);
  state.categories.forEach(cat => {
    const label = document.createElement('label');
    const checked = cat.id === selected ? 'checked' : '';
    label.innerHTML = `<input type="radio" name="${containerId}" value="${cat.id}" ${checked} /> ${escHtml(cat.name)}`;
    dropdown.appendChild(label);
  });
}

function getSelectedCategoryIds(containerId) {
  const radio = document.querySelector(`#${containerId} input[type="radio"]:checked`);
  return radio && radio.value ? [radio.value] : [];
}

function renderGroceryTab() {
  renderCategoryBar();
  renderGroceryList();
}

function renderGroceryList() {
  const container = document.getElementById('grocery-list');
  const header = document.getElementById('grocery-list-header');
  container.innerHTML = '';

  if (state.items.length === 0) {
    header.classList.add('hidden');
    container.innerHTML = '<div class="empty-state">No items yet. Add something above!</div>';
    return;
  }
  header.classList.remove('hidden');

  const sections = [];
  state.categories.forEach(cat => {
    const catItems = state.items.filter(i => (i.categoryIds || []).includes(cat.id));
    if (catItems.length > 0) sections.push({ title: cat.name, items: catItems });
  });
  const uncategorized = state.items.filter(i => (i.categoryIds || []).length === 0);
  if (uncategorized.length > 0) sections.push({ title: 'Uncategorized', items: uncategorized });

  if (sections.length === 0) {
    container.innerHTML = '<div class="empty-state">No items yet. Add something above!</div>';
    return;
  }

  sections.forEach(section => {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'category-section';
    sectionEl.innerHTML = `<h3>${escHtml(section.title)}</h3>`;
    const list = document.createElement('div');
    list.className = 'item-list';
    section.items.forEach(item => list.appendChild(buildItemRow(item)));
    sectionEl.appendChild(list);
    container.appendChild(sectionEl);
  });
}

function buildItemRow(item) {
  const row = document.createElement('div');
  row.className = 'item-row' + (item.checked ? ' checked' : '');
  row.dataset.id = item.id;
  row.innerHTML = `
    <input type="checkbox" class="item-check" ${item.checked ? 'checked' : ''} />
    <div class="item-info">
      <span class="item-name">${escHtml(item.name)}</span>
      <span class="item-qty">×${item.quantity}</span>
      ${catTagsHtml(item.categoryIds)}
    </div>
    <div class="item-actions">
      <button class="btn-icon edit-item-btn" title="Edit">✎</button>
      <button class="btn-icon danger remove-item-btn" title="Remove">×</button>
    </div>`;
  return row;
}

function buildItemEditRow(item) {
  const row = document.createElement('div');
  row.className = 'item-row';
  row.dataset.id = item.id;
  const dropdownId = `edit-cat-dropdown-${item.id}`;
  row.innerHTML = `
    <form class="item-edit-form" data-id="${item.id}">
      <input type="text" class="edit-name" value="${escHtml(item.name)}" required maxlength="80" />
      <input type="number" class="edit-qty" value="${item.quantity}" min="0.01" step="any" required />
      <div class="category-picker-wrapper">
        <button type="button" class="btn-ghost edit-cat-btn">Category</button>
        <div id="${dropdownId}" class="category-dropdown hidden"></div>
      </div>
      <button type="submit" class="btn-primary">Save</button>
      <button type="button" class="btn-ghost cancel-edit-btn">Cancel</button>
    </form>`;
  setTimeout(() => renderCategoryDropdown(dropdownId, item.categoryIds || []), 0);
  return row;
}

// ─── Meal builder ─────────────────────────────────────────────────────────────

function showMealBuilder() {
  builderItems = [];
  document.getElementById('new-meal-btn').classList.add('hidden');
  renderMealBuilder();
  document.getElementById('meal-builder').classList.remove('hidden');
  document.getElementById('builder-meal-name').focus();
}

function hideMealBuilder() {
  builderItems = [];
  document.getElementById('meal-builder').classList.add('hidden');
  document.getElementById('new-meal-btn').classList.remove('hidden');
}

function renderMealBuilder(savedMealName) {
  const builder = document.getElementById('meal-builder');
  const addDropdownId = 'builder-new-item-cat';

  const itemsHtml = builderItems.length === 0
    ? '<div class="builder-empty">No items added yet.</div>'
    : builderItems.map(bi => builderItemRowHtml(bi)).join('');

  builder.innerHTML = `
    <div class="builder-header">
      <span class="builder-title">New Meal</span>
    </div>
    <div class="builder-name-row">
      <input type="text" id="builder-meal-name" placeholder="Meal name" maxlength="80"
        value="${escHtml(savedMealName || '')}" />
    </div>
    <div class="builder-items" id="builder-items-list">${itemsHtml}</div>
    <form class="builder-add-item-form" id="builder-add-item-form">
      <input type="text" class="bai-name" placeholder="Item name" required maxlength="80" />
      <input type="number" class="bai-qty" value="1" min="0.01" step="any" required />
      ${buildCatPickerHtml(addDropdownId, [])}
      <button type="submit" class="btn-ghost">+ Add Item</button>
    </form>
    <div class="builder-footer">
      <button id="cancel-builder-btn" class="btn-ghost">Cancel</button>
      <button id="save-meal-btn" class="btn-primary">Save Meal</button>
    </div>`;
}

function builderItemRowHtml(bi) {
  return `
    <div class="builder-item-row" data-id="${bi.id}">
      <span class="meal-item-name">${escHtml(bi.name)}</span>
      <span class="meal-item-qty">×${bi.quantity}</span>
      ${catTagsHtml(bi.categoryIds)}
      <div class="meal-item-actions">
        <button class="btn-icon edit-builder-item-btn" title="Edit">✎</button>
        <button class="btn-icon danger remove-builder-item-btn" title="Remove">×</button>
      </div>
    </div>`;
}

function builderItemEditRowHtml(bi) {
  const dropdownId = `builder-item-edit-cat-${bi.id}`;
  return `
    <div class="builder-item-row builder-item-editing" data-id="${bi.id}">
      <input type="text" class="bitem-edit-name" value="${escHtml(bi.name)}" maxlength="80" />
      <input type="number" class="bitem-edit-qty" value="${bi.quantity}" min="0.01" step="any" />
      ${buildCatPickerHtml(dropdownId, bi.categoryIds || [])}
      <button type="button" class="btn-primary save-builder-item-edit-btn">Save</button>
      <button type="button" class="btn-ghost cancel-builder-item-edit-btn">Cancel</button>
    </div>`;
}

// ─── Render: meals tab ────────────────────────────────────────────────────────

function renderMealsTab() {
  const container = document.getElementById('meals-list');
  container.innerHTML = '';
  if (state.meals.length === 0) {
    container.innerHTML = '<div class="empty-state">No meals yet. Click "+ New Meal" to get started!</div>';
    return;
  }
  state.meals.forEach(meal => container.appendChild(buildMealCard(meal)));
}

function buildMealCard(meal) {
  const card = document.createElement('div');
  card.className = 'meal-card';
  card.dataset.id = meal.id;

  const itemsHtml = meal.items.length === 0
    ? '<div class="meal-empty">No items in this meal.</div>'
    : meal.items.map(mi => `
        <div class="meal-item-row" data-item-id="${mi.id}">
          <span class="meal-item-name">${escHtml(mi.name)}</span>
          <span class="meal-item-qty">×${mi.quantity}</span>
          ${catTagsHtml(mi.categoryIds)}
        </div>`).join('');

  card.innerHTML = `
    <div class="meal-header">
      <span class="meal-title">${escHtml(meal.name)}</span>
      <div class="meal-header-actions">
        <button class="btn-icon edit-meal-btn" title="Edit meal">✎</button>
        <button class="btn-icon danger remove-meal-btn" title="Delete meal">×</button>
      </div>
    </div>
    <div class="meal-body">
      <div class="meal-items">${itemsHtml}</div>
    </div>
    <div class="meal-footer">
      <button class="btn-add-to-list" ${meal.items.length === 0 ? 'disabled' : ''}>Add to Grocery List</button>
    </div>`;
  return card;
}

function enterMealEditMode(card, mealId) {
  const meal = state.meals.find(m => m.id === mealId);
  if (!meal) return;
  const addDropdownId = `meal-edit-new-item-cat-${mealId}`;

  const itemsHtml = meal.items.length === 0
    ? '<div class="meal-empty">No items yet.</div>'
    : meal.items.map(mi => mealItemEditModeRowHtml(mi)).join('');

  card.innerHTML = `
    <div class="meal-header">
      <input type="text" class="meal-title-input" value="${escHtml(meal.name)}" maxlength="80" />
      <div class="meal-header-actions">
        <button class="btn-ghost cancel-meal-edit-btn">Cancel</button>
        <button class="btn-primary save-meal-edit-btn">Save</button>
      </div>
    </div>
    <div class="meal-body">
      <div class="meal-items">${itemsHtml}</div>
      <form class="meal-add-item-form" data-meal-id="${mealId}">
        <input type="text" class="mai-name" placeholder="Item name" required maxlength="80" />
        <input type="number" class="mai-qty" value="1" min="0.01" step="any" required />
        ${buildCatPickerHtml(addDropdownId, [])}
        <button type="submit" class="btn-ghost">+ Add</button>
      </form>
    </div>`;

  card.querySelector('.meal-title-input').focus();
}

// A meal item row as shown in edit mode (has edit + remove buttons, shows category tags)
function mealItemEditModeRowHtml(mi) {
  return `
    <div class="meal-item-row" data-item-id="${mi.id}">
      <span class="meal-item-name">${escHtml(mi.name)}</span>
      <span class="meal-item-qty">×${mi.quantity}</span>
      ${catTagsHtml(mi.categoryIds)}
      <div class="meal-item-actions">
        <button class="btn-icon edit-meal-item-btn" title="Edit item">✎</button>
        <button class="btn-icon danger remove-meal-item-btn" title="Remove item">×</button>
      </div>
    </div>`;
}

// A meal item row expanded to inline edit form
function mealItemEditFormHtml(mi) {
  const dropdownId = `meal-item-edit-cat-${mi.id}`;
  return `
    <div class="meal-item-row meal-item-editing" data-item-id="${mi.id}">
      <input type="text" class="mitem-edit-name" value="${escHtml(mi.name)}" maxlength="80" />
      <input type="number" class="mitem-edit-qty" value="${mi.quantity}" min="0.01" step="any" />
      ${buildCatPickerHtml(dropdownId, mi.categoryIds || [])}
      <button type="button" class="btn-primary save-meal-item-edit-btn">Save</button>
      <button type="button" class="btn-ghost cancel-meal-item-edit-btn">Cancel</button>
    </div>`;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function openMealModal(mealId) {
  const meal = state.meals.find(m => m.id === mealId);
  if (!meal || meal.items.length === 0) return;

  const content = document.getElementById('modal-content');
  content.innerHTML = `
    <div class="modal-title">Add from "${escHtml(meal.name)}"</div>
    <div class="modal-subtitle">Select items to add to your grocery list:</div>
    <div class="modal-item-list">
      ${meal.items.map(mi => `
        <label class="modal-item-row">
          <input type="checkbox" value="${mi.id}" checked />
          <span class="modal-item-name">${escHtml(mi.name)}</span>
          <span class="modal-item-qty">×${mi.quantity}</span>
        </label>`).join('')}
    </div>
    <div class="modal-actions">
      <button class="btn-ghost" id="modal-cancel-btn">Cancel</button>
      <button class="btn-primary" id="modal-confirm-btn">Add Selected</button>
    </div>`;

  document.getElementById('modal-backdrop').classList.remove('hidden');
  document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
  document.getElementById('modal-confirm-btn').addEventListener('click', () => {
    const selected = Array.from(
      content.querySelectorAll('input[type="checkbox"]:checked')
    ).map(cb => cb.value);
    addMealToGroceryList(mealId, selected);
    closeModal();
  });
}

function closeModal() {
  document.getElementById('modal-backdrop').classList.add('hidden');
}

function confirmDelete(message, onConfirm) {
  const content = document.getElementById('modal-content');
  content.innerHTML = `
    <div class="modal-title">Delete?</div>
    <div class="modal-subtitle">${escHtml(message)}</div>
    <div class="modal-actions">
      <button class="btn-ghost" id="modal-cancel-btn">Cancel</button>
      <button class="btn-primary" id="modal-confirm-btn" style="background:var(--danger)">Delete</button>
    </div>`;
  document.getElementById('modal-backdrop').classList.remove('hidden');
  document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
  document.getElementById('modal-confirm-btn').addEventListener('click', () => { closeModal(); onConfirm(); });
}

// ─── Render (top-level) ───────────────────────────────────────────────────────

function render() {
  if (state.activeTab === 'grocery') renderGroceryTab();
  else renderMealsTab();
}

// ─── Event wiring ─────────────────────────────────────────────────────────────

function wireEvents() {
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // ── Category bar ──

  document.getElementById('add-category-btn').addEventListener('click', () => {
    document.getElementById('add-category-btn').classList.add('hidden');
    document.getElementById('add-category-form').classList.remove('hidden');
    document.getElementById('new-category-name').focus();
  });

  document.getElementById('cancel-category-btn').addEventListener('click', () => {
    document.getElementById('add-category-form').classList.add('hidden');
    document.getElementById('add-category-btn').classList.remove('hidden');
    document.getElementById('new-category-name').value = '';
  });

  document.getElementById('add-category-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('new-category-name').value.trim();
    if (!name) return;
    addCategory(name);
    document.getElementById('new-category-name').value = '';
    document.getElementById('add-category-form').classList.add('hidden');
    document.getElementById('add-category-btn').classList.remove('hidden');
    renderGroceryTab();
  });

  document.getElementById('category-chips').addEventListener('click', e => {
    const chip = e.target.closest('.category-chip');
    if (!chip) return;
    const catId = chip.dataset.id;
    if (e.target.classList.contains('remove-cat-btn')) {
      removeCategory(catId); renderGroceryTab(); return;
    }
    if (e.target.classList.contains('chip-name')) startCategoryEdit(chip, catId);
  });

  // ── Add item form (grocery tab) ──

  document.getElementById('item-category-picker-btn').addEventListener('click', e => {
    e.stopPropagation();
    const dropdown = document.getElementById('item-category-dropdown');
    const isOpen = !dropdown.classList.contains('hidden');
    document.querySelectorAll('.category-dropdown').forEach(d => d.classList.add('hidden'));
    if (!isOpen) {
      const currentRadio = dropdown.querySelector('input[type="radio"]:checked');
      const currentSel = currentRadio && currentRadio.value ? [currentRadio.value] : [];
      renderCategoryDropdown('item-category-dropdown', currentSel);
      dropdown.classList.remove('hidden');
    }
  });

  document.getElementById('add-item-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('new-item-name').value.trim();
    const qty  = parseFloat(document.getElementById('new-item-qty').value);
    const cats = getSelectedCategoryIds('item-category-dropdown');
    if (!name || isNaN(qty)) return;
    addItem(name, qty, cats);
    document.getElementById('new-item-name').value = '';
    document.getElementById('new-item-qty').value = '1';
    document.getElementById('item-category-dropdown').classList.add('hidden');
    document.getElementById('item-category-picker-btn').textContent = 'Category';
    renderGroceryList();
  });

  // ── Grocery list (delegated) ──

  document.getElementById('grocery-list').addEventListener('click', e => {
    const row = e.target.closest('.item-row');
    if (!row) return;
    const itemId = row.dataset.id;

    if (e.target.classList.contains('item-check')) {
      toggleItem(itemId); renderGroceryList(); return;
    }
    if (e.target.classList.contains('remove-item-btn')) {
      const item = state.items.find(i => i.id === itemId);
      confirmDelete(`Remove "${item ? item.name : 'this item'}" from your grocery list?`, () => { removeItem(itemId); renderGroceryList(); });
      return;
    }
    if (e.target.classList.contains('edit-item-btn')) {
      const item = state.items.find(i => i.id === itemId);
      if (!item) return;
      const editRow = buildItemEditRow(item);
      row.replaceWith(editRow);
      editRow.querySelector('.edit-name').focus();
      return;
    }
    if (e.target.classList.contains('edit-cat-btn')) {
      e.stopPropagation();
      const dropdownId = `edit-cat-dropdown-${itemId}`;
      const dropdown = document.getElementById(dropdownId);
      document.querySelectorAll('.category-dropdown').forEach(d => d.classList.add('hidden'));
      dropdown.classList.toggle('hidden');
      return;
    }
    if (e.target.classList.contains('cancel-edit-btn')) {
      renderGroceryList(); return;
    }
  });

  document.getElementById('grocery-list').addEventListener('submit', e => {
    if (!e.target.classList.contains('item-edit-form')) return;
    e.preventDefault();
    const itemId = e.target.dataset.id;
    const name = e.target.querySelector('.edit-name').value.trim();
    const qty  = parseFloat(e.target.querySelector('.edit-qty').value);
    const cats = getSelectedCategoryIds(`edit-cat-dropdown-${itemId}`);
    if (!name || isNaN(qty)) return;
    editItem(itemId, name, qty, cats);
    renderGroceryList();
  });

  // ── Clear list button ──

  document.getElementById('clear-list-btn').addEventListener('click', () => {
    confirmDelete('Clear all items from your grocery list? Your saved meals will not be affected.', () => {
      clearList(); renderGroceryList();
    });
  });

  // ── New meal button ──

  document.getElementById('new-meal-btn').addEventListener('click', showMealBuilder);

  // ── Meal builder (delegated) ──

  document.getElementById('meal-builder').addEventListener('click', e => {
    if (e.target.id === 'cancel-builder-btn') {
      hideMealBuilder(); return;
    }

    if (e.target.id === 'save-meal-btn') {
      const nameInput = document.getElementById('builder-meal-name');
      const name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      addMeal(name, builderItems);
      hideMealBuilder();
      renderMealsTab();
      return;
    }

    const builderRow = e.target.closest('.builder-item-row');

    // Edit a staged builder item
    if (e.target.classList.contains('edit-builder-item-btn') && builderRow) {
      const bi = builderItems.find(b => b.id === builderRow.dataset.id);
      if (!bi) return;
      builderRow.outerHTML; // just a read, no-op
      builderRow.insertAdjacentHTML('afterend', builderItemEditRowHtml(bi));
      builderRow.remove();
      return;
    }

    // Save a builder item inline edit
    if (e.target.classList.contains('save-builder-item-edit-btn') && builderRow) {
      const id = builderRow.dataset.id;
      const name = builderRow.querySelector('.bitem-edit-name').value.trim();
      const qty  = parseFloat(builderRow.querySelector('.bitem-edit-qty').value);
      const cats = getCheckedCatIds(`builder-item-edit-cat-${id}`);
      if (!name || isNaN(qty)) return;
      const bi = builderItems.find(b => b.id === id);
      if (bi) { bi.name = name; bi.quantity = qty; bi.categoryIds = cats; }
      builderRow.insertAdjacentHTML('afterend', builderItemRowHtml(bi));
      builderRow.remove();
      return;
    }

    // Cancel a builder item inline edit
    if (e.target.classList.contains('cancel-builder-item-edit-btn') && builderRow) {
      const bi = builderItems.find(b => b.id === builderRow.dataset.id);
      if (bi) {
        builderRow.insertAdjacentHTML('afterend', builderItemRowHtml(bi));
        builderRow.remove();
      }
      return;
    }

    // Remove a staged builder item
    if (e.target.classList.contains('remove-builder-item-btn') && builderRow) {
      const savedName = document.getElementById('builder-meal-name').value;
      builderItems = builderItems.filter(bi => bi.id !== builderRow.dataset.id);
      renderMealBuilder(savedName);
      return;
    }
  });

  document.getElementById('meal-builder').addEventListener('submit', e => {
    if (e.target.id !== 'builder-add-item-form') return;
    e.preventDefault();
    const name = e.target.querySelector('.bai-name').value.trim();
    const qty  = parseFloat(e.target.querySelector('.bai-qty').value);
    const cats = getCheckedCatIds('builder-new-item-cat');
    if (!name || isNaN(qty)) return;
    const savedMealName = document.getElementById('builder-meal-name').value;
    builderItems.push({ id: newId(), name, quantity: qty, categoryIds: cats });
    renderMealBuilder(savedMealName);
    document.getElementById('builder-add-item-form').querySelector('.bai-name').focus();
  });

  // ── Meals list (delegated) ──

  document.getElementById('meals-list').addEventListener('click', e => {
    const card = e.target.closest('.meal-card');
    if (!card) return;
    const mealId = card.dataset.id;

    if (e.target.classList.contains('remove-meal-btn')) {
      const meal = state.meals.find(m => m.id === mealId);
      confirmDelete(`Delete meal "${meal ? meal.name : 'this meal'}"?`, () => { removeMeal(mealId); renderMealsTab(); });
      return;
    }
    if (e.target.classList.contains('edit-meal-btn')) {
      enterMealEditMode(card, mealId); return;
    }
    if (e.target.classList.contains('cancel-meal-edit-btn')) {
      renderMealsTab(); return;
    }
    if (e.target.classList.contains('save-meal-edit-btn')) {
      const nameInput = card.querySelector('.meal-title-input');
      const name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      editMeal(mealId, name);
      renderMealsTab();
      return;
    }
    if (e.target.classList.contains('btn-add-to-list')) {
      openMealModal(mealId); return;
    }

    const itemRow = e.target.closest('.meal-item-row');
    if (!itemRow) return;
    const itemId = itemRow.dataset.itemId;

    // Edit a meal item (in edit mode)
    if (e.target.classList.contains('edit-meal-item-btn')) {
      const meal = state.meals.find(m => m.id === mealId);
      const mi = meal?.items.find(i => i.id === itemId);
      if (!mi) return;
      itemRow.insertAdjacentHTML('afterend', mealItemEditFormHtml(mi));
      itemRow.remove();
      return;
    }

    // Save inline meal item edit
    if (e.target.classList.contains('save-meal-item-edit-btn')) {
      const name = itemRow.querySelector('.mitem-edit-name').value.trim();
      const qty  = parseFloat(itemRow.querySelector('.mitem-edit-qty').value);
      const cats = getCheckedCatIds(`meal-item-edit-cat-${itemId}`);
      if (!name || isNaN(qty)) return;
      editMealItem(mealId, itemId, name, qty, cats);
      // Replace the edit row with the updated read row (still in edit mode for the card)
      const meal = state.meals.find(m => m.id === mealId);
      const mi = meal?.items.find(i => i.id === itemId);
      if (mi) {
        itemRow.insertAdjacentHTML('afterend', mealItemEditModeRowHtml(mi));
        itemRow.remove();
      }
      return;
    }

    // Cancel inline meal item edit
    if (e.target.classList.contains('cancel-meal-item-edit-btn')) {
      const meal = state.meals.find(m => m.id === mealId);
      const mi = meal?.items.find(i => i.id === itemId);
      if (mi) {
        itemRow.insertAdjacentHTML('afterend', mealItemEditModeRowHtml(mi));
        itemRow.remove();
      }
      return;
    }

    // Remove a meal item (in edit mode)
    if (e.target.classList.contains('remove-meal-item-btn')) {
      const meal = state.meals.find(m => m.id === mealId);
      const mi = meal && meal.items.find(i => i.id === itemId);
      confirmDelete(`Remove "${mi ? mi.name : 'this item'}" from the meal?`, () => { removeMealItem(mealId, itemId); enterMealEditMode(card, mealId); });
      return;
    }
  });

  document.getElementById('meals-list').addEventListener('submit', e => {
    if (!e.target.classList.contains('meal-add-item-form')) return;
    e.preventDefault();
    const mealId = e.target.dataset.mealId;
    const name = e.target.querySelector('.mai-name').value.trim();
    const qty  = parseFloat(e.target.querySelector('.mai-qty').value);
    const cats = getCheckedCatIds(`meal-edit-new-item-cat-${mealId}`);
    if (!name || isNaN(qty)) return;
    addMealItem(mealId, name, qty, cats);
    const card = e.target.closest('.meal-card');
    if (card) enterMealEditMode(card, mealId);
  });

  // ── Modal backdrop click to close ──

  document.getElementById('modal-backdrop').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-backdrop')) closeModal();
  });

  // ── Generic category picker toggle (.cat-picker-toggle-btn) ──

  document.addEventListener('click', e => {
    if (e.target.classList.contains('cat-picker-toggle-btn')) {
      e.stopPropagation();
      const dropdownId = e.target.dataset.dropdown;
      const dropdown = document.getElementById(dropdownId);
      if (!dropdown) return;
      const isOpen = !dropdown.classList.contains('hidden');
      document.querySelectorAll('.category-dropdown').forEach(d => d.classList.add('hidden'));
      if (!isOpen) dropdown.classList.remove('hidden');
      return;
    }

    // Close dropdown after selecting a radio option and update button label
    if (e.target.type === 'radio' && e.target.closest('.category-dropdown')) {
      const dropdown = e.target.closest('.category-dropdown');
      dropdown.classList.add('hidden');
      const label = e.target.value ? e.target.closest('label').textContent.trim() : 'Category';
      const btn = document.querySelector(`.cat-picker-toggle-btn[data-dropdown="${dropdown.id}"]`)
        || (dropdown.id === 'item-category-dropdown' ? document.getElementById('item-category-picker-btn') : null);
      if (btn) btn.textContent = label;
      return;
    }

    // Close all dropdowns on outside click
    if (!e.target.closest('.category-picker-wrapper') && e.target.id !== 'item-category-picker-btn') {
      document.querySelectorAll('.category-dropdown').forEach(d => d.classList.add('hidden'));
    }
  });
}

// ─── Category chip inline edit ────────────────────────────────────────────────

function startCategoryEdit(chip, catId) {
  const nameSpan = chip.querySelector('.chip-name');
  const currentName = nameSpan.textContent;
  const input = document.createElement('input');
  input.value = currentName;
  input.maxLength = 40;
  chip.replaceChild(input, nameSpan);
  input.focus(); input.select();

  function commit() {
    const newName = input.value.trim();
    if (newName && newName !== currentName) editCategory(catId, newName);
    renderGroceryTab();
  }

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.value = currentName; input.blur(); }
  });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

loadState();
wireEvents();
render();

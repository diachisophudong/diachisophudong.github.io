'use strict';

/* ============================================================
   SỐ HOÁ ĐỊA CHỈ NHÀ - Thôn Bảo An - Xã Phù Đổng
   Tìm kiếm phía máy khách (không phụ thuộc bên ngoài):
   - Tối thiểu 3 ký tự, tối đa 8 hộ gợi ý (nhóm theo family_id)
   - Lọc Năm Sinh (chính xác) + Thôn (chính xác)
   - Điều hướng bàn phím, Enter, Esc, debounce 120ms
   ============================================================ */

let peopleData = [];
const MIN_CHARS = 3;
const MAX_SUGGESTIONS = 8;
const DEBOUNCE_MS = 120;
const COMMUNE_MAP_URL =
  'https://www.google.com/maps/search/?api=1&query=X%C3%A3+Ph%C3%B9+%C4%90%E1%BB%95ng';

// Biểu tượng SVG nội tuyến (không dùng emoji)
const ICONS = {
  person:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>'
};

// Lấy phần tử DOM
const searchBox = document.getElementById('searchBox');
const suggestionsList = document.getElementById('suggestionsList');
const resultsContainer = document.getElementById('resultsContainer');
const resetBtn = document.getElementById('resetBtn');
const dobFilter = document.getElementById('dobFilter');
const villageFilter = document.getElementById('villageFilter');
const searchBtn = document.getElementById('searchBtn');
const directionBtn = document.getElementById('directionBtn');

// Trạng thái
let debounceTimer = null;
let currentGroups = []; // các hộ đang hiển thị trong danh sách gợi ý
let activeIndex = -1;   // vị trí con trỏ bàn phím trong gợi ý
let selectedResult = null; // hộ đang hiển thị ở thẻ kết quả

// ---------- Tiện ích ----------

function escHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

// ---------- Tải dữ liệu ----------

async function loadData() {
  try {
    const response = await fetch('./data/data.json', { cache: 'no-cache' });
    peopleData = await response.json();
    populateYearDropdown();
    populateVillageDropdown();
  } catch (error) {
    console.error('Lỗi tải dữ liệu:', error);
  }
}

// Điền danh sách năm sinh từ năm hiện tại về 1900
function populateYearDropdown() {
  const currentYear = new Date().getFullYear();
  for (let year = currentYear; year >= 1900; year--) {
    const option = document.createElement('option');
    option.value = year.toString();
    option.textContent = year.toString();
    dobFilter.appendChild(option);
  }
}

// Điền danh sách thôn từ dữ liệu (sắp xếp theo tiếng Việt, bỏ giá trị rỗng)
function populateVillageDropdown() {
  const villages = [...new Set(peopleData.map((person) => person.village))]
    .filter((village) => typeof village === 'string' && village.trim() !== '')
    .sort((a, b) => a.localeCompare(b, 'vi'));
  villages.forEach((village) => {
    const option = document.createElement('option');
    option.value = village;
    option.textContent = village;
    villageFilter.appendChild(option);
  });
}

// ---------- Sự kiện ----------

function initializeEventListeners() {
  searchBox.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSearch, DEBOUNCE_MS);
  });

  searchBox.addEventListener('focus', handleSearchFocus);

  searchBox.addEventListener('keydown', handleSearchKeydown);

  resetBtn.addEventListener('click', handleReset);
  dobFilter.addEventListener('change', runSearch);
  villageFilter.addEventListener('change', runSearch);
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideSuggestions();
    }
  });

  searchBtn.addEventListener('click', () => {
    if (suggestionsList.classList.contains('show') && suggestionsList.children.length > 0) {
      selectSuggestion(currentGroups[0]);
    } else {
      searchBox.focus();
      runSearch();
    }
  });

  directionBtn.addEventListener('click', () => {
    if (!directionBtn.classList.contains('is-active')) return;
    const link =
      selectedResult && selectedResult.matchedPerson && selectedResult.matchedPerson.google_maps;
    window.open(link || COMMUNE_MAP_URL, '_blank', 'noopener');
  });
}

// Trạng thái nút "CHỈ ĐƯỜNG": mờ cho tới khi một hộ được chọn
function setDirectionState(active) {
  const btn = document.getElementById('directionBtn');
  if (!btn) return;
  btn.classList.toggle('is-active', active);
  btn.setAttribute('aria-disabled', String(!active));
}

// ---------- Tìm kiếm ----------

function runSearch() {
  const query = searchBox.value.trim();

  // Hiện / ẩn nút xoá
  if (query.length > 0 || dobFilter.value || villageFilter.value) {
    resetBtn.classList.add('show');
  } else {
    resetBtn.classList.remove('show');
    hideSuggestions();
    resultsContainer.classList.remove('show');
    resultsContainer.innerHTML = '';
    selectedResult = null;
  }

  // Hiện gợi ý khi từ khoá đủ 3 ký tự trở lên
  if (query.length >= MIN_CHARS) {
    const familyGroups = filterAndGroupData(query);
    currentGroups = familyGroups;
    if (familyGroups.length > 0) {
      displaySuggestions(familyGroups);
    } else {
      hideSuggestions();
    }
  } else {
    hideSuggestions();
  }
}

// Khi nhập lại ô tìm kiếm: khôi phục danh sách gợi ý cũ
function handleSearchFocus() {
  const query = searchBox.value.trim();
  if (query.length >= MIN_CHARS) {
    const familyGroups = filterAndGroupData(query);
    currentGroups = familyGroups;
    if (familyGroups.length > 0) {
      displaySuggestions(familyGroups);
    }
  }
}

// Điều hướng bàn phím trong ô tìm kiếm
function handleSearchKeydown(e) {
  const open = suggestionsList.classList.contains('show') && suggestionsList.children.length > 0;

  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!open) return;
    e.preventDefault();
    const count = suggestionsList.children.length;
    if (e.key === 'ArrowDown') {
      activeIndex = (activeIndex + 1) % count;
    } else {
      activeIndex = activeIndex <= 0 ? count - 1 : activeIndex - 1;
    }
    updateActiveOption();
  } else if (e.key === 'Enter') {
    if (open) {
      e.preventDefault();
      selectSuggestion(currentGroups[activeIndex >= 0 ? activeIndex : 0]);
    }
  } else if (e.key === 'Escape') {
    hideSuggestions();
  }
}

// Đóng gợi ý khi bấm ra ngoài vùng tìm kiếm
function handleDocumentClick(e) {
  if (!e.target.closest('.search-container')) {
    hideSuggestions();
  }
}

// Lọc dữ liệu theo từ khoá + bộ lọc, nhóm theo family_id
function filterAndGroupData(query) {
  const lowerQuery = query.toLowerCase();
  const dobFilterValue = dobFilter.value.trim();
  const villageFilterValue = villageFilter.value.trim().toLowerCase();

  // Kiểm tra giá trị lọc năm sinh
  let isValidDobFilter = true;
  let dobFilterNum = null;

  if (dobFilterValue !== '') {
    dobFilterNum = parseInt(dobFilterValue, 10);
    if (isNaN(dobFilterNum) || dobFilterNum < 1900 || dobFilterNum > new Date().getFullYear()) {
      isValidDobFilter = false;
    }
  }

  // Lọc người khớp từ khoá và các bộ lọc
  const matchedPeople = peopleData.filter((person) => {
    if (!isValidDobFilter) {
      return false;
    }

    const name = person.person.toLowerCase();
    const address = person.address.toLowerCase();
    const hamlet = person.hamlet.toLowerCase();
    const village = person.village.toLowerCase();
    const commune = person.commune.toLowerCase();
    const dob = person.person_dob.toLowerCase();

    const matchesQuery =
      query.length < MIN_CHARS ||
      name.includes(lowerQuery) ||
      address.includes(lowerQuery) ||
      hamlet.includes(lowerQuery) ||
      village.includes(lowerQuery) ||
      commune.includes(lowerQuery) ||
      dob.includes(lowerQuery);

    // Lọc năm sinh: khớp chính xác năm
    const matchesDob = dobFilterValue === '' || person.person_dob === dobFilterValue;

    // Lọc thôn: khớp chính xác tên thôn (so không phân biệt hoa thường)
    const matchesVillage =
      villageFilterValue === '' || person.village.trim().toLowerCase() === villageFilterValue;

    return matchesQuery && matchesDob && matchesVillage;
  });

  // Lấy danh sách family_id duy nhất từ kết quả khớp
  const uniqueFamilyIds = [...new Set(matchedPeople.map((p) => p.family_id))];

  // Với mỗi family_id: lấy NGUYÊN HỘ từ dữ liệu đầy đủ
  // và ghi nhớ người khớp trong hộ đó
  const familyGroupsWithMatched = uniqueFamilyIds.map((familyId) => {
    const allFamilyMembers = peopleData.filter((person) => person.family_id === familyId);
    const matchedPersonInFamily = matchedPeople.find((p) => p.family_id === familyId);
    return {
      familyMembers: allFamilyMembers,
      matchedPerson: matchedPersonInFamily
    };
  });

  // Giới hạn số hộ hiển thị
  return familyGroupsWithMatched.slice(0, MAX_SUGGESTIONS);
}

// ---------- Gợi ý ----------

function displaySuggestions(familyGroups) {
  suggestionsList.innerHTML = '';
  activeIndex = -1;
  searchBox.removeAttribute('aria-activedescendant');

  familyGroups.forEach((group, index) => {
    const li = document.createElement('li');
    li.id = 'suggestion-' + index;
    li.className = 'suggestion-item';
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', 'false');

    const matchedPerson = group.matchedPerson;
    const familyMembers = group.familyMembers;
    const memberCount = familyMembers.length;

    // Các thành viên khác trong hộ (khác người được khớp)
    const otherMembers = familyMembers.filter((p) => p.person !== matchedPerson.person);
    const otherMembersNames = otherMembers.map((p) => escHtml(p.person)).join(', ');

    li.innerHTML = `
      <span class="suggestion-icon">${ICONS.person}</span>
      <div class="suggestion-text">
        <div class="suggestion-address">${escHtml(matchedPerson.person)} - ${escHtml(matchedPerson.person_dob)}</div>
        ${otherMembersNames ? `<div class="suggestion-family">(Gia đình: ${otherMembersNames})</div>` : ''}
        <div class="suggestion-meta">${memberCount} người - ${[matchedPerson.hamlet, matchedPerson.village, matchedPerson.commune].filter(Boolean).map(escHtml).join(', ')}</div>
      </div>
    `;

    li.addEventListener('click', () => selectSuggestion(group));
    suggestionsList.appendChild(li);
  });

  suggestionsList.classList.add('show');
  searchBox.setAttribute('aria-expanded', 'true');
}

function updateActiveOption() {
  const items = suggestionsList.children;
  for (let i = 0; i < items.length; i++) {
    const isActive = i === activeIndex;
    items[i].classList.toggle('active', isActive);
    items[i].setAttribute('aria-selected', isActive ? 'true' : 'false');
  }
  if (activeIndex >= 0 && items[activeIndex]) {
    searchBox.setAttribute('aria-activedescendant', items[activeIndex].id);
    items[activeIndex].scrollIntoView({ block: 'nearest' });
  } else {
    searchBox.removeAttribute('aria-activedescendant');
  }
}

function hideSuggestions() {
  suggestionsList.classList.remove('show');
  searchBox.setAttribute('aria-expanded', 'false');
  searchBox.removeAttribute('aria-activedescendant');
  activeIndex = -1;
}

// ---------- Chọn gợi ý & hiển thị kết quả ----------

function selectSuggestion(group) {
  if (!group) return;
  searchBox.value = group.matchedPerson.person;
  resetBtn.classList.add('show');
  hideSuggestions();
  selectedResult = group;
  displayResults(group.familyMembers, group.matchedPerson);
}

function displayResults(familyMembers, searchedPerson) {
  const otherMembers = familyMembers.filter((p) => p.person !== searchedPerson.person);
  const otherMembersNames = otherMembers.map((p) => escHtml(p.person)).join(', ');

  const resultsHtml = `
    <div class="result-item">
      <div class="result-address">
        <span class="result-name">${escHtml(searchedPerson.person)}</span>
        ${otherMembersNames ? `<span class="result-family-members">(Gia đình: ${otherMembersNames})</span>` : ''}
      </div>
      <div class="result-details">
        <div class="result-detail-item">
          <span class="result-detail-label">Năm Sinh</span>
          <span class="result-detail-value">${escHtml(searchedPerson.person_dob)}</span>
        </div>
        ${searchedPerson.hamlet ? `
        <div class="result-detail-item">
          <span class="result-detail-label">Xóm</span>
          <span class="result-detail-value">${escHtml(searchedPerson.hamlet)}</span>
        </div>` : ''}
        <div class="result-detail-item">
          <span class="result-detail-label">Thôn</span>
          <span class="result-detail-value">${escHtml(searchedPerson.village)}</span>
        </div>
        <div class="result-detail-item">
          <span class="result-detail-label">Xã</span>
          <span class="result-detail-value">${escHtml(searchedPerson.commune)}</span>
        </div>
        <div class="result-detail-item">
          <span class="result-detail-label">Gia Đình</span>
          <span class="result-detail-value">#${escHtml(searchedPerson.family_id)}</span>
        </div>
        <div class="result-detail-item result-detail-item--full">
          <span class="result-detail-label">Địa Chỉ Đầy Đủ</span>
          <span class="result-detail-value">${escHtml(searchedPerson.address)}</span>
        </div>
      </div>
    </div>
  `;

  resultsContainer.innerHTML = resultsHtml;
  resultsContainer.classList.add('show');
  resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  setDirectionState(true);
}

// ---------- Xoá tìm kiếm ----------

function handleReset() {
  clearTimeout(debounceTimer);
  searchBox.value = '';
  dobFilter.value = '';
  villageFilter.value = '';
  resetBtn.classList.remove('show');
  hideSuggestions();
  suggestionsList.innerHTML = '';
  resultsContainer.classList.remove('show');
  resultsContainer.innerHTML = '';
  selectedResult = null;
  setDirectionState(false);
  searchBox.focus();
}

// ---------- Khởi chạy ----------

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  initializeEventListeners();
  setDirectionState(false);
});

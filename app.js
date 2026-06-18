const STORAGE_KEY = "life-xp-pwa-state-v1";
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

const defaultState = {
  tasks: [
    { id: crypto.randomUUID(), name: "운동", unit: "회", xp: 2, weeklyLimit: 3, color: "#55c7a6" },
    { id: crypto.randomUUID(), name: "논문작업", unit: "시간", xp: 1, weeklyLimit: 3, color: "#69a8d8" },
    { id: crypto.randomUUID(), name: "영상 편집 작업", unit: "영상", xp: 1, weeklyLimit: null, color: "#e5b74b" },
    { id: crypto.randomUUID(), name: "카운터 수술", unit: "건", xp: 1, weeklyLimit: null, color: "#df6c5f" },
    { id: crypto.randomUUID(), name: "내 수술", unit: "건", xp: 2, weeklyLimit: null, color: "#b187d8" }
  ],
  levels: [10, 25, 45, 70, 100, 135, 175, 220, 270, 325],
  rewards: [
    { id: crypto.randomUUID(), name: "10만원 마음껏 쓰기", description: "죄책감 없이 원하는 것에 쓰는 날" },
    { id: crypto.randomUUID(), name: "컴퓨터 업그레이드하기", description: "부품 후보를 고르고 장비를 성장시키기" },
    { id: crypto.randomUUID(), name: "6시간 게임하기", description: "일정 비우고 제대로 몰입하기" },
    { id: crypto.randomUUID(), name: "술 약속 잡아서 술마시는 날", description: "좋은 사람과 즐겁게 마시기" },
    { id: crypto.randomUUID(), name: "가족과 놀러가는 날", description: "가족 일정부터 먼저 잡기" }
  ],
  logs: [],
  inventory: [],
  settledLevel: 1
};

let state = loadState();
let deferredInstallPrompt = null;

const elements = {
  levelNumber: document.querySelector("#levelNumber"),
  totalXpText: document.querySelector("#totalXpText"),
  xpFill: document.querySelector("#xpFill"),
  currentLevelXpText: document.querySelector("#currentLevelXpText"),
  nextLevelXpText: document.querySelector("#nextLevelXpText"),
  taskGrid: document.querySelector("#taskGrid"),
  timelineList: document.querySelector("#timelineList"),
  inventoryGrid: document.querySelector("#inventoryGrid"),
  rewardPoolList: document.querySelector("#rewardPoolList"),
  rewardPoolCount: document.querySelector("#rewardPoolCount"),
  rewardInventoryCount: document.querySelector("#rewardInventoryCount"),
  avatarPanel: document.querySelector(".avatar-panel"),
  rankBadge: document.querySelector("#rankBadge"),
  levelRulesList: document.querySelector("#levelRulesList"),
  taskRulesList: document.querySelector("#taskRulesList"),
  toast: document.querySelector("#toast"),
  installButton: document.querySelector("#installButton"),
  taskDialog: document.querySelector("#taskDialog"),
  taskForm: document.querySelector("#taskForm"),
  taskDialogTitle: document.querySelector("#taskDialogTitle"),
  taskId: document.querySelector("#taskId"),
  taskName: document.querySelector("#taskName"),
  taskUnit: document.querySelector("#taskUnit"),
  taskXp: document.querySelector("#taskXp"),
  taskLimit: document.querySelector("#taskLimit"),
  taskColor: document.querySelector("#taskColor"),
  rewardDialog: document.querySelector("#rewardDialog"),
  rewardForm: document.querySelector("#rewardForm"),
  rewardDialogTitle: document.querySelector("#rewardDialogTitle"),
  rewardId: document.querySelector("#rewardId"),
  rewardName: document.querySelector("#rewardName"),
  rewardDescription: document.querySelector("#rewardDescription")
};

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => switchView(tab.dataset.view));
});

document.querySelector("#addTaskButton").addEventListener("click", () => openTaskDialog());
document.querySelector("#addRewardButton").addEventListener("click", () => openRewardDialog());
document.querySelector("#addLevelButton").addEventListener("click", addLevelRule);
document.querySelector("#clearLogsButton").addEventListener("click", clearLogs);
document.querySelector("#settleRewardsButton").addEventListener("click", settleRewards);
elements.taskForm.addEventListener("submit", saveTaskFromDialog);
elements.rewardForm.addEventListener("submit", saveRewardFromDialog);
elements.installButton.addEventListener("click", installPwa);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  elements.installButton.hidden = false;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

render();

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(defaultState);

  try {
    const parsed = JSON.parse(saved);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      tasks: parsed.tasks?.length ? parsed.tasks : structuredClone(defaultState.tasks),
      rewards: parsed.rewards?.length ? parsed.rewards : structuredClone(defaultState.rewards),
      levels: parsed.levels?.length ? parsed.levels : structuredClone(defaultState.levels),
      logs: parsed.logs || [],
      inventory: parsed.inventory || [],
      settledLevel: parsed.settledLevel || 1
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  renderLevel();
  renderTasks();
  renderTimeline();
  renderRewards();
  renderSettings();
  saveState();
}

function totalXp() {
  return state.logs.reduce((sum, log) => sum + log.xpGained, 0);
}

function levelFromXp(xp) {
  let level = 1;
  let previous = 0;

  for (const needed of normalizedLevels()) {
    if (xp < needed) break;
    level += 1;
    previous = needed;
  }

  const next = normalizedLevels()[level - 1] ?? null;
  return { level, previous, next };
}

function normalizedLevels() {
  return [...state.levels]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
}

function renderLevel() {
  const xp = totalXp();
  const info = levelFromXp(xp);
  const range = info.next ? info.next - info.previous : 1;
  const progress = info.next ? ((xp - info.previous) / range) * 100 : 100;

  elements.levelNumber.textContent = info.level;
  elements.totalXpText.textContent = `총 ${xp} XP`;
  elements.xpFill.style.width = `${Math.min(100, Math.max(0, progress))}%`;
  elements.currentLevelXpText.textContent = `${xp - info.previous} XP`;
  elements.nextLevelXpText.textContent = info.next
    ? `다음 레벨까지 ${info.next - xp} XP`
    : "최고 레벨 도달";

  const rank = rankForLevel(info.level);
  elements.avatarPanel.dataset.rank = rank.key;
  elements.rankBadge.textContent = rank.label;
}

function rankForLevel(level) {
  if (level >= 12) return { key: "legend", label: "Legend" };
  if (level >= 8) return { key: "hero", label: "Hero" };
  if (level >= 5) return { key: "adept", label: "Adept" };
  if (level >= 3) return { key: "trained", label: "Trained" };
  return { key: "rookie", label: "Rookie" };
}

function renderTasks() {
  elements.taskGrid.innerHTML = "";
  state.tasks.forEach((task) => {
    const used = weeklyUnitsForTask(task.id);
    const limit = task.weeklyLimit;
    const capped = limit !== null && limit !== undefined && limit !== "";
    const available = capped ? Math.max(0, limit - used) : Infinity;
    const card = document.createElement("article");
    card.className = "task-card";
    card.innerHTML = `
      <header>
        <div class="task-color" style="background:${escapeHtml(task.color)}"></div>
        <h3>${escapeHtml(task.name)}</h3>
        <button class="icon-button" type="button" aria-label="${escapeHtml(task.name)} 수정" title="수정">✎</button>
      </header>
      <p>${task.xp} XP / ${escapeHtml(task.unit)} · ${capped ? `이번 주 ${used}/${limit}` : "주간 제한 없음"}</p>
      <div class="limit-meter" aria-hidden="true">
        <div class="limit-fill" style="width:${capped ? Math.min(100, (used / limit) * 100) : 0}%; background:${escapeHtml(task.color)}"></div>
      </div>
      <div class="task-actions">
        <div class="stepper">
          <button type="button" data-step="-1" aria-label="수량 줄이기">−</button>
          <input value="1" inputmode="numeric" pattern="[0-9]*" aria-label="수량">
          <button type="button" data-step="1" aria-label="수량 늘리기">+</button>
        </div>
        <button class="primary-button" type="button" ${available <= 0 ? "disabled" : ""}>획득</button>
      </div>
    `;

    const editButton = card.querySelector("header button");
    const input = card.querySelector("input");
    const gainButton = card.querySelector(".primary-button");
    card.querySelectorAll("[data-step]").forEach((button) => {
      button.addEventListener("click", () => {
        input.value = Math.max(1, Number(input.value || 1) + Number(button.dataset.step));
      });
    });
    editButton.addEventListener("click", () => openTaskDialog(task));
    gainButton.addEventListener("click", () => addXp(task, Number(input.value || 1)));
    elements.taskGrid.append(card);
  });
}

function weeklyUnitsForTask(taskId) {
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day).getTime();
  return state.logs
    .filter((log) => log.taskId === taskId && log.createdAt >= weekStart && log.createdAt < weekStart + ONE_WEEK)
    .reduce((sum, log) => sum + log.units, 0);
}

function addXp(task, units) {
  const count = Math.max(1, Math.floor(units));
  const used = weeklyUnitsForTask(task.id);
  const capped = task.weeklyLimit !== null && task.weeklyLimit !== undefined && task.weeklyLimit !== "";
  const allowedUnits = capped ? Math.min(count, Math.max(0, task.weeklyLimit - used)) : count;

  if (allowedUnits <= 0) {
    showToast("이번 주 제한을 이미 채웠어요.");
    return;
  }

  const before = levelFromXp(totalXp()).level;
  const xpGained = allowedUnits * Number(task.xp);
  state.logs.unshift({
    id: crypto.randomUUID(),
    taskId: task.id,
    taskName: task.name,
    units: allowedUnits,
    unit: task.unit,
    xpGained,
    createdAt: Date.now()
  });
  const after = levelFromXp(totalXp()).level;

  if (after > before) {
    grantRewards(before + 1, after);
  } else {
    showToast(`${task.name} +${xpGained} XP`);
  }

  render();
}

function grantRewards(fromLevel, toLevel) {
  if (!state.rewards.length) {
    showToast(`레벨 ${toLevel} 달성! 보상 카드를 먼저 추가해 주세요.`);
    state.settledLevel = Math.max(state.settledLevel, toLevel);
    return;
  }

  const names = [];
  for (let level = fromLevel; level <= toLevel; level += 1) {
    const reward = state.rewards[Math.floor(Math.random() * state.rewards.length)];
    state.inventory.unshift({
      id: crypto.randomUUID(),
      rewardId: reward.id,
      name: reward.name,
      description: reward.description,
      level,
      createdAt: Date.now()
    });
    names.push(`LV ${level}: ${reward.name}`);
  }
  state.settledLevel = Math.max(state.settledLevel, toLevel);
  showToast(`레벨업! ${names.join(" · ")}`);
}

function settleRewards() {
  const currentLevel = levelFromXp(totalXp()).level;
  if (currentLevel <= state.settledLevel) {
    showToast("정산할 새 레벨 보상이 없어요.");
    return;
  }
  grantRewards(state.settledLevel + 1, currentLevel);
  render();
}

function renderTimeline() {
  const logs = state.logs.slice(0, 20);
  elements.timelineList.innerHTML = logs.length
    ? ""
    : `<div class="empty-state">아직 기록이 없어요. 오늘 하나 해내면 여기에 남습니다.</div>`;

  logs.forEach((log) => {
    const item = document.createElement("div");
    item.className = "timeline-item";
    item.innerHTML = `
      <div>
        <p>${escapeHtml(log.taskName)} ${log.units}${escapeHtml(log.unit)}</p>
        <small>${formatDate(log.createdAt)}</small>
      </div>
      <strong>+${log.xpGained} XP</strong>
    `;
    elements.timelineList.append(item);
  });
}

function renderRewards() {
  elements.rewardPoolCount.textContent = state.rewards.length;
  elements.rewardInventoryCount.textContent = state.inventory.length;
  elements.inventoryGrid.innerHTML = state.inventory.length
    ? ""
    : `<div class="empty-state">레벨업하면 여기에 카드가 쌓입니다.</div>`;

  state.inventory.forEach((reward) => {
    const card = document.createElement("article");
    card.className = "reward-card";
    card.innerHTML = `
      <small>LV ${reward.level} 보상</small>
      <h3>${escapeHtml(reward.name)}</h3>
      <p>${escapeHtml(reward.description || "획득한 즐거움 카드")}</p>
    `;
    elements.inventoryGrid.append(card);
  });

  renderRewardPool();
}

function renderRewardPool() {
  elements.rewardPoolList.innerHTML = "";
  state.rewards.forEach((reward) => {
    const row = document.createElement("div");
    row.className = "editable-row";
    row.innerHTML = `
      <div>
        <p>${escapeHtml(reward.name)}</p>
        <small>${escapeHtml(reward.description || "설명 없음")}</small>
      </div>
      <div class="editable-actions">
        <button class="quiet-button" type="button">수정</button>
        <button class="danger-button" type="button">삭제</button>
      </div>
    `;
    row.querySelector(".quiet-button").addEventListener("click", () => openRewardDialog(reward));
    row.querySelector(".danger-button").addEventListener("click", () => deleteReward(reward.id));
    elements.rewardPoolList.append(row);
  });
}

function renderSettings() {
  renderLevelRules();
  renderTaskRules();
}

function renderLevelRules() {
  elements.levelRulesList.innerHTML = "";
  normalizedLevels().forEach((xp, index) => {
    const row = document.createElement("div");
    row.className = "editable-row";
    row.innerHTML = `
      <div>
        <p>레벨 ${index + 2}</p>
        <small>총 ${xp} XP 도달 시</small>
      </div>
      <div class="editable-actions">
        <input aria-label="레벨 ${index + 2} 필요 XP" type="number" min="1" step="1" value="${xp}">
        <button class="danger-button" type="button">삭제</button>
      </div>
    `;
    const input = row.querySelector("input");
    input.addEventListener("change", () => {
      state.levels[index] = Math.max(1, Number(input.value || xp));
      state.levels = normalizedLevels();
      render();
    });
    row.querySelector("button").addEventListener("click", () => {
      state.levels.splice(index, 1);
      render();
    });
    elements.levelRulesList.append(row);
  });
}

function renderTaskRules() {
  elements.taskRulesList.innerHTML = "";
  state.tasks.forEach((task) => {
    const row = document.createElement("div");
    row.className = "editable-row";
    row.innerHTML = `
      <div>
        <p>${escapeHtml(task.name)}</p>
        <small>${task.xp} XP/${escapeHtml(task.unit)} · ${task.weeklyLimit ? `주 ${task.weeklyLimit}${escapeHtml(task.unit)} 제한` : "제한 없음"}</small>
      </div>
      <div class="editable-actions">
        <button class="quiet-button" type="button">수정</button>
        <button class="danger-button" type="button">삭제</button>
      </div>
    `;
    row.querySelector(".quiet-button").addEventListener("click", () => openTaskDialog(task));
    row.querySelector(".danger-button").addEventListener("click", () => deleteTask(task.id));
    elements.taskRulesList.append(row);
  });
}

function addLevelRule() {
  const levels = normalizedLevels();
  const last = levels.at(-1) || 0;
  const previous = levels.at(-2) || 0;
  const gap = Math.max(10, last - previous);
  state.levels = [...levels, last + gap];
  render();
}

function openTaskDialog(task = null) {
  elements.taskDialogTitle.textContent = task ? "과제 수정" : "과제 추가";
  elements.taskId.value = task?.id || "";
  elements.taskName.value = task?.name || "";
  elements.taskUnit.value = task?.unit || "회";
  elements.taskXp.value = task?.xp ?? 1;
  elements.taskLimit.value = task?.weeklyLimit ?? "";
  elements.taskColor.value = task?.color || "#55c7a6";
  elements.taskDialog.showModal();
}

function saveTaskFromDialog(event) {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();

  const task = {
    id: elements.taskId.value || crypto.randomUUID(),
    name: elements.taskName.value.trim(),
    unit: elements.taskUnit.value.trim(),
    xp: Math.max(0, Number(elements.taskXp.value || 0)),
    weeklyLimit: elements.taskLimit.value === "" ? null : Math.max(0, Number(elements.taskLimit.value)),
    color: elements.taskColor.value
  };

  const index = state.tasks.findIndex((item) => item.id === task.id);
  if (index >= 0) state.tasks[index] = task;
  else state.tasks.push(task);

  elements.taskDialog.close();
  render();
}

function deleteTask(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task || !confirm(`${task.name} 과제를 삭제할까요? 기존 기록은 유지됩니다.`)) return;
  state.tasks = state.tasks.filter((item) => item.id !== taskId);
  render();
}

function openRewardDialog(reward = null) {
  elements.rewardDialogTitle.textContent = reward ? "카드 수정" : "카드 추가";
  elements.rewardId.value = reward?.id || "";
  elements.rewardName.value = reward?.name || "";
  elements.rewardDescription.value = reward?.description || "";
  elements.rewardDialog.showModal();
}

function saveRewardFromDialog(event) {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();

  const reward = {
    id: elements.rewardId.value || crypto.randomUUID(),
    name: elements.rewardName.value.trim(),
    description: elements.rewardDescription.value.trim()
  };

  const index = state.rewards.findIndex((item) => item.id === reward.id);
  if (index >= 0) state.rewards[index] = reward;
  else state.rewards.push(reward);

  elements.rewardDialog.close();
  render();
}

function deleteReward(rewardId) {
  const reward = state.rewards.find((item) => item.id === rewardId);
  if (!reward || !confirm(`${reward.name} 카드를 풀에서 삭제할까요? 이미 획득한 카드는 유지됩니다.`)) return;
  state.rewards = state.rewards.filter((item) => item.id !== rewardId);
  render();
}

function clearLogs() {
  if (!state.logs.length || !confirm("모든 경험치 기록을 비울까요? 획득 카드도 함께 초기화됩니다.")) return;
  state.logs = [];
  state.inventory = [];
  state.settledLevel = 1;
  render();
}

function switchView(viewId) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.view === viewId);
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("is-active", view.id === viewId);
  });
}

function installPwa() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  deferredInstallPrompt = null;
  elements.installButton.hidden = true;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 3600);
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

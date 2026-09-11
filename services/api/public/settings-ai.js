(function () {
  //#region src/routes/login/components/styles.generated.ts
  const aiUsagePage = {
    backLink: 'hominem-backLink--fAqmaq',
    bar: 'hominem-bar--fAqmaq',
    barFill: 'hominem-barFill--fAqmaq',
    bigNumber: 'hominem-bigNumber--fAqmaq',
    card: 'hominem-card--fAqmaq',
    cardTitle: 'hominem-cardTitle--fAqmaq',
    hero: 'hominem-hero--fAqmaq',
    driverCost: 'hominem-driverCost--fAqmaq',
    driverHead: 'hominem-driverHead--fAqmaq',
    driverMain: 'hominem-driverMain--fAqmaq',
    driverMeta: 'hominem-driverMeta--fAqmaq',
    driverName: 'hominem-driverName--fAqmaq',
    driverRow: 'hominem-driverRow--fAqmaq',
    drivers: 'hominem-drivers--fAqmaq',
    impactGrid: 'hominem-impactGrid--fAqmaq',
    impactHead: 'hominem-impactHead--fAqmaq',
    impactItem: 'hominem-impactItem--fAqmaq',
    impactLink: 'hominem-impactLink--fAqmaq',
    impactValue: 'hominem-impactValue--fAqmaq',
    muted: 'hominem-muted--fAqmaq',
    page: 'hominem-page--fAqmaq',
    pacing: 'hominem-pacing--fAqmaq',
    seg: 'hominem-seg--fAqmaq',
    segButton: 'hominem-segButton--fAqmaq',
    shareFill: 'hominem-shareFill--fAqmaq',
    shareTrack: 'hominem-shareTrack--fAqmaq',
    spark: 'hominem-spark--fAqmaq',
    sparkBar: 'hominem-sparkBar--fAqmaq',
    statusRow: 'hominem-statusRow--fAqmaq',
    tally: 'hominem-tally--fAqmaq',
    tallyLabel: 'hominem-tallyLabel--fAqmaq',
    tallyRow: 'hominem-tallyRow--fAqmaq',
    tallyValue: 'hominem-tallyValue--fAqmaq',
    trend: 'hominem-trend--fAqmaq',
    trendBar: 'hominem-trendBar--fAqmaq',
    trendCol: 'hominem-trendCol--fAqmaq',
    trendLabel: 'hominem-trendLabel--fAqmaq',
    twoCol: 'hominem-twoCol--fAqmaq',
  };
  //#endregion
  //#region src/routes/login/settings-ai.ts
  const usdFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  });
  const monthLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
  });
  const dayLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const FEATURE_LABELS = {
    chat_stream: 'Chat',
    text_enhance: 'Enhance',
    note_generate: 'Notes',
    task_extract: 'Tasks',
    voice_task_extract: 'Voice tasks',
    time_block_extract: 'Schedule',
    voice_cleanup: 'Voice cleanup',
    chat_speech: 'Voice',
    embedding: 'Embeddings',
    mcp_tool_call: 'MCP tools',
    career_resume_convert: 'Resume',
    career_resume_customize: 'Resume edits',
    career_job_scrape: 'Job search',
    career_skills_derive: 'Skills',
    file_image_analyze: 'Image analysis',
    file_document_summarize: 'Document summaries',
  };
  const OPERATION_LABELS = {
    chat_completion: 'Chat completion',
    structured_output: 'Structured output',
    embedding: 'Embeddings',
    speech: 'Speech',
  };
  function formatUsd(amount) {
    return usdFormatter.format(amount);
  }
  function formatTokens(tokens) {
    if (tokens >= 1e6) return `${(tokens / 1e6).toFixed(1)}M`;
    if (tokens >= 1e3) return `${(tokens / 1e3).toFixed(1)}k`;
    return String(tokens);
  }
  const ESTIMATED_WATER_LITERS_PER_REQUEST = 0.01;
  const ESTIMATED_ELECTRICITY_KWH_PER_REQUEST = 34e-5;
  function formatLiters(liters) {
    if (liters < 1) return `${Math.round(liters * 1e3)} mL`;
    return `${liters.toFixed(1)} L`;
  }
  function formatElectricity(kilowattHours) {
    if (kilowattHours < 1) return `${Math.round(kilowattHours * 1e3)} Wh`;
    return `${kilowattHours.toFixed(2)} kWh`;
  }
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== void 0) node.textContent = text;
    return node;
  }
  function find(selector) {
    return document.querySelector(selector);
  }
  function clear(node) {
    node.replaceChildren();
  }
  const usd = (amount) => formatUsd(amount);
  function renderStatus(data) {
    const period = find('[data-uai-period]');
    const total = find('[data-uai-total]');
    const limit = find('[data-uai-limit]');
    const bar = find('[data-uai-bar]');
    const pacing = find('[data-uai-pacing]');
    const reset = find('[data-uai-reset]');
    if (!period || !total || !limit || !bar || !pacing || !reset) return;
    const { monthly, summary, daily } = data;
    const start = new Date(monthly.periodStart);
    period.textContent = `${monthLabel.format(start)} ${start.getUTCFullYear()}`;
    total.textContent = usd(monthly.totalCostUsd);
    limit.textContent = `of ${usd(monthly.limitUsd)}`;
    const percent = Math.min(100, (monthly.totalCostUsd / monthly.limitUsd) * 100);
    bar.style.width = `${percent}%`;
    bar.dataset.over = monthly.totalCostUsd >= monthly.limitUsd ? '' : void 0;
    const now = /* @__PURE__ */ new Date();
    const elapsedDays = Math.max(1, Math.floor((now.getTime() - start.getTime()) / 864e5) + 1);
    const monthDays = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
    ).getUTCDate();
    const projected = (monthly.totalCostUsd / elapsedDays) * monthDays;
    const dailyAverage = daily.length > 0 ? monthly.totalCostUsd / elapsedDays : 0;
    const dayOfCap = dailyAverage > 0 ? Math.floor(monthly.limitUsd / dailyAverage) : null;
    if (monthly.totalCostUsd >= monthly.limitUsd) {
      pacing.textContent =
        "You've reached this month's AI budget — AI features are paused until it resets.";
      pacing.dataset.over = '';
    } else if (dayOfCap !== null && dayOfCap <= monthDays) {
      pacing.textContent =
        dayOfCap <= elapsedDays
          ? `At this pace you'll pass the budget around today (projected ${usd(projected)}).`
          : `At this pace, ${usd(projected)} total — the budget runs out around day ${dayOfCap} of ${monthDays}.`;
      pacing.dataset.over = projected >= monthly.limitUsd ? '' : void 0;
    } else {
      pacing.textContent = `At this pace you'd use about ${usd(projected)} — under the ${usd(monthly.limitUsd)} budget.`;
      delete pacing.dataset.over;
    }
    const daysUntilReset = Math.ceil(
      (new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)).getTime() -
        now.getTime()) /
        864e5,
    );
    reset.textContent =
      daysUntilReset === 1
        ? `Budget resets tomorrow. ${summary.requestCount} requests so far.`
        : `Budget resets in ${daysUntilReset} days. ${summary.requestCount} requests so far.`;
  }
  function renderDaily(daily) {
    const container = find('[data-uai-daily]');
    if (!container) return;
    clear(container);
    const max = Math.max(0, ...daily.map((point) => point.totalCostUsd));
    if (daily.length === 0) return;
    for (const point of daily) {
      const bar = document.createElement('div');
      bar.className = aiUsagePage.sparkBar;
      const height = max > 0 ? Math.max(4, (point.totalCostUsd / max) * 100) : 4;
      bar.style.height = `${height.toFixed(1)}%`;
      if (point.totalCostUsd === 0) bar.dataset.zero = '';
      bar.title = `${dayLabel.format(new Date(point.bucketStart))}: ${usd(point.totalCostUsd)}`;
      container.append(bar);
    }
  }
  function renderDrivers(data, dimension) {
    const list = find('[data-uai-drivers]');
    const seg = find('[data-uai-seg]');
    if (!list || !seg) return;
    seg.querySelectorAll('[data-uai-dim]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.uaiDim === dimension));
    });
    const rows =
      dimension === 'feature'
        ? data.byFeature
        : dimension === 'model'
          ? data.byModel
          : dimension === 'operation'
            ? data.byOperation
            : data.daily.map((point) => ({
                day: dayLabel.format(new Date(point.bucketStart)),
                totalCostUsd: point.totalCostUsd,
                totalTokens: 0,
                requestCount: point.requestCount,
              }));
    const total = rows.reduce((sum, row) => sum + row.totalCostUsd, 0);
    clear(list);
    if (rows.length === 0) {
      list.append(el('p', aiUsagePage.muted, 'No usage recorded this month yet.'));
      return;
    }
    const nameOf = (row) => {
      if (dimension === 'feature')
        return FEATURE_LABELS[String(row.feature)] ?? String(row.feature);
      if (dimension === 'model') return row.model === null ? 'Unknown model' : String(row.model);
      if (dimension === 'operation')
        return OPERATION_LABELS[String(row.operation)] ?? String(row.operation);
      return String(row.day);
    };
    for (const row of rows) {
      const share = total > 0 ? (row.totalCostUsd / total) * 100 : 0;
      const rowEl = el('div', aiUsagePage.driverRow);
      const left = el('div', aiUsagePage.driverMain);
      left.append(el('p', aiUsagePage.driverName, nameOf(row)));
      const tokens = Number(row.totalTokens ?? 0);
      left.append(
        el(
          'p',
          aiUsagePage.driverMeta,
          `${row.requestCount} request${row.requestCount === 1 ? '' : 's'}${tokens > 0 ? ` · ${formatTokens(tokens)} tokens` : ''}`,
        ),
      );
      rowEl.append(
        left,
        el('p', aiUsagePage.driverCost, `${usd(row.totalCostUsd)} · ${share.toFixed(0)}%`),
      );
      const track = el('div', aiUsagePage.shareTrack);
      const fill = el('div', aiUsagePage.shareFill);
      fill.style.width = `${share.toFixed(1)}%`;
      track.append(fill);
      rowEl.append(track);
      list.append(rowEl);
    }
  }
  function renderTrend(points) {
    const container = find('[data-uai-trend]');
    if (!container) return;
    clear(container);
    const max = Math.max(0, ...points.map((point) => point.totalCostUsd));
    for (const point of points) {
      const col = el('div', aiUsagePage.trendCol);
      const height = max > 0 ? Math.max(6, (point.totalCostUsd / max) * 100) : 6;
      const bar = document.createElement('div');
      bar.className = aiUsagePage.trendBar;
      bar.style.height = `${height.toFixed(1)}%`;
      if (point.totalCostUsd === 0) bar.dataset.zero = '';
      const date = new Date(point.bucketStart);
      bar.title = `${monthLabel.format(date)} ${date.getFullYear()}: ${usd(point.totalCostUsd)}`;
      col.append(bar, el('p', aiUsagePage.trendLabel, monthLabel.format(date)));
      container.append(col);
    }
  }
  function renderWasteAndEfficiency(data) {
    const waste = find('[data-uai-waste]');
    const efficiency = find('[data-uai-efficiency]');
    if (!waste || !efficiency) return;
    clear(waste);
    clear(efficiency);
    const { summary } = data;
    const noUsage = Math.max(0, summary.requestCount - summary.usageAvailableCount);
    waste.append(
      el('p', aiUsagePage.tallyLabel, 'Waste'),
      el(
        'p',
        aiUsagePage.tallyValue,
        `${summary.failedCount} failed request${summary.failedCount === 1 ? '' : 's'} · ${usd(summary.failedCostUsd)} wasted`,
      ),
      el(
        'p',
        aiUsagePage.tallyLabel,
        noUsage > 0
          ? `${noUsage} request${noUsage === 1 ? '' : 's'} with no usage data (unpriced)`
          : 'No unpriced requests',
      ),
    );
    const cacheShare =
      summary.totalTokens > 0
        ? ((summary.cachedInputTokens / summary.totalTokens) * 100).toFixed(0)
        : '0';
    const reasoningShare =
      summary.totalTokens > 0
        ? ((summary.reasoningTokens / summary.totalTokens) * 100).toFixed(0)
        : '0';
    efficiency.append(
      el('p', aiUsagePage.tallyLabel, 'Efficiency'),
      el(
        'p',
        aiUsagePage.tallyValue,
        `${formatTokens(summary.cachedInputTokens)} tokens served from cache (${cacheShare}% of total)`,
      ),
      el(
        'p',
        aiUsagePage.tallyLabel,
        `${reasoningShare}% reasoning tokens · ${formatTokens(summary.reasoningTokens)}`,
      ),
    );
    const impact = find('[data-uai-impact-grid]');
    if (!impact) return;
    clear(impact);
    const water = summary.requestCount * ESTIMATED_WATER_LITERS_PER_REQUEST;
    const electricity = summary.requestCount * ESTIMATED_ELECTRICITY_KWH_PER_REQUEST;
    for (const [label, value] of [
      ['Water', formatLiters(water)],
      ['Electricity', formatElectricity(electricity)],
    ]) {
      const item = el('div', aiUsagePage.impactItem);
      item.append(el('p', aiUsagePage.tallyLabel, label), el('p', aiUsagePage.impactValue, value));
      impact.append(item);
    }
  }
  async function load() {
    let data;
    try {
      const response = await fetch('/api/usage/ai', { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`usage fetch failed: ${response.status}`);
      data = await response.json();
    } catch {
      return;
    }
    renderStatus(data);
    renderDaily(data.daily);
    renderDrivers(data, 'feature');
    renderTrend(data.monthlyTrend);
    renderWasteAndEfficiency(data);
    find('[data-uai-seg]')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-uai-dim]');
      if (!button?.dataset.uaiDim) return;
      renderDrivers(data, button.dataset.uaiDim);
    });
  }
  load();
  //#endregion
})();

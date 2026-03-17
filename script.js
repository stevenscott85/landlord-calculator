let storedData = {};
const FORM_ENDPOINT = "";

function getValue(id) {
  return +document.getElementById(id).value || 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2
  }).format(value);
}

function formatPercent(value) {
  return `${value.toFixed(2)}%`;
}

function updatePreview() {
  const value = getValue("value");
  const loan = getValue("loan");
  const rent = getValue("rent");
  const mortgage = getValue("mortgage");
  const costs = getValue("costs");
  const insurance = getValue("insurance");
  const voids = getValue("voids");
  const taxRate = getValue("tax") / 100;

  const totalCosts = mortgage + costs + insurance + voids;
  const monthlyProfitBeforeTax = rent - totalCosts;
  const tax = monthlyProfitBeforeTax > 0 ? monthlyProfitBeforeTax * taxRate : 0;
  const netMonthly = monthlyProfitBeforeTax - tax;
  const yearly = netMonthly * 12;
  const equity = value - loan;
  const saleCosts = value * 0.03;
  const netSale = equity - saleCosts;
  const netYield = value > 0 ? (yearly / value) * 100 : 0;

  document.getElementById("previewProfit").textContent = formatCurrency(netMonthly);
  document.getElementById("previewYield").textContent = formatPercent(netYield);
  document.getElementById("previewSale").textContent = formatCurrency(netSale);
}

function fillDemoData() {
  document.getElementById("value").value = 185000;
  document.getElementById("loan").value = 118000;
  document.getElementById("rent").value = 975;
  document.getElementById("mortgage").value = 545;
  document.getElementById("costs").value = 95;
  document.getElementById("insurance").value = 26;
  document.getElementById("voids").value = 55;
  document.getElementById("tax").value = 20;
  updatePreview();
}

function calculateScore(netMonthly, netYield, equity, value) {
  let score = 50;

  if (netMonthly > 400) score += 20;
  else if (netMonthly > 250) score += 12;
  else if (netMonthly > 100) score += 6;
  else if (netMonthly < 0) score -= 28;
  else if (netMonthly < 100) score -= 10;

  if (netYield > 7) score += 18;
  else if (netYield > 5) score += 10;
  else if (netYield > 3) score += 4;
  else if (netYield < 2) score -= 18;
  else if (netYield < 3) score -= 10;

  const equityRatio = value > 0 ? equity / value : 0;
  if (equityRatio > 0.45) score += 10;
  else if (equityRatio < 0.15) score -= 10;

  if (score > 100) score = 100;
  if (score < 0) score = 0;

  return score;
}

function calculate() {
  const value = getValue("value");
  const loan = getValue("loan");
  const rent = getValue("rent");
  const mortgage = getValue("mortgage");
  const costs = getValue("costs");
  const insurance = getValue("insurance");
  const voids = getValue("voids");
  const taxRate = getValue("tax") / 100;

  if (!value || !loan || !rent || !mortgage || !getValue("tax")) {
    alert("Fill in Property Value, Mortgage Balance, Rent, Mortgage Payment and Tax Rate first.");
    return;
  }

  const totalMonthlyCosts = mortgage + costs + insurance + voids;
  const monthlyProfitBeforeTax = rent - totalMonthlyCosts;
  const tax = monthlyProfitBeforeTax > 0 ? monthlyProfitBeforeTax * taxRate : 0;
  const netMonthly = monthlyProfitBeforeTax - tax;
  const yearly = netMonthly * 12;

  const equity = value - loan;
  const grossYield = value > 0 ? (rent * 12 / value) * 100 : 0;
  const netYield = value > 0 ? (yearly / value) * 100 : 0;

  const saleCosts = value * 0.03;
  const netSale = equity - saleCosts;

  const fiveYear = yearly * 5;
  const score = calculateScore(netMonthly, netYield, equity, value);

  let verdict = "HOLD";
  let verdictClass = "score-neutral";
  let verdictText = "Borderline result. Review the numbers carefully before deciding.";

  if (score >= 70) {
    verdict = "STRONG HOLD";
    verdictClass = "score-good";
    verdictText = "On these numbers, the property looks more like an asset worth keeping.";
  } else if (score < 40) {
    verdict = "CONSIDER SELLING";
    verdictClass = "score-bad";
    verdictText = "On these numbers, the property looks weaker and may deserve a serious exit review.";
  }

  storedData = {
    value,
    loan,
    rent,
    mortgage,
    costs,
    insurance,
    voids,
    taxRate,
    totalMonthlyCosts,
    monthlyProfitBeforeTax,
    tax,
    netMonthly,
    yearly,
    equity,
    grossYield,
    netYield,
    saleCosts,
    netSale,
    fiveYear,
    score,
    verdict,
    verdictClass,
    verdictText
  };

  document.getElementById("emailGate").classList.remove("hidden");
  document.getElementById("emailGate").scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildSummaryText(d) {
  return [
    `Verdict: ${d.verdict} (${d.score}/100)`,
    `Monthly net profit: ${formatCurrency(d.netMonthly)}`,
    `Yearly net profit: ${formatCurrency(d.yearly)}`,
    `Gross yield: ${formatPercent(d.grossYield)}`,
    `Net yield: ${formatPercent(d.netYield)}`,
    `Equity: ${formatCurrency(d.equity)}`,
    `Estimated net sale cash: ${formatCurrency(d.netSale)}`,
    `Estimated 5-year hold profit: ${formatCurrency(d.fiveYear)}`
  ].join("\n");
}

function copySummary() {
  if (!storedData || !storedData.verdict) {
    alert("Run the calculator first.");
    return;
  }

  navigator.clipboard.writeText(buildSummaryText(storedData))
    .then(() => alert("Summary copied."))
    .catch(() => alert("Could not copy summary on this device."));
}

function renderResults() {
  const d = storedData;

  const resultsHtml = `
    <div class="result-card wide">
      <h3>Decision</h3>
      <div class="score-box">
        <p class="metric-value">${d.score}/100</p>
        <span class="score-pill ${d.verdictClass}">${d.verdict}</span>
      </div>
      <p class="metric-sub">${d.verdictText}</p>
    </div>

    <div class="result-card wide">
      <h3>Monthly Net Profit</h3>
      <p class="metric-value">${formatCurrency(d.netMonthly)}</p>
      <p class="metric-sub">After estimated monthly costs and tax.</p>
    </div>

    <div class="result-card">
      <h3>Yearly Net Profit</h3>
      <p class="metric-value">${formatCurrency(d.yearly)}</p>
      <p class="metric-sub">Estimated annual take-home from this property.</p>
    </div>

    <div class="result-card">
      <h3>Gross Yield</h3>
      <p class="metric-value">${formatPercent(d.grossYield)}</p>
      <p class="metric-sub">Rent before costs vs property value.</p>
    </div>

    <div class="result-card">
      <h3>Net Yield</h3>
      <p class="metric-value">${formatPercent(d.netYield)}</p>
      <p class="metric-sub">Net annual profit vs property value.</p>
    </div>

    <div class="result-card">
      <h3>Equity</h3>
      <p class="metric-value">${formatCurrency(d.equity)}</p>
      <p class="metric-sub">Property value minus mortgage balance.</p>
    </div>

    <div class="result-card">
      <h3>Estimated Sale Costs</h3>
      <p class="metric-value">${formatCurrency(d.saleCosts)}</p>
      <p class="metric-sub">Assumes roughly 3% selling friction.</p>
    </div>

    <div class="result-card">
      <h3>Net Sale Cash</h3>
      <p class="metric-value">${formatCurrency(d.netSale)}</p>
      <p class="metric-sub">Equity after estimated selling costs.</p>
    </div>

    <div class="result-card">
      <h3>5-Year Hold Profit</h3>
      <p class="metric-value">${formatCurrency(d.fiveYear)}</p>
      <p class="metric-sub">Simple projection using current annual net profit.</p>
    </div>

    <div class="result-card full">
      <h3>Action Summary</h3>
      <div class="summary-box">
        Based on the figures entered, this property currently shows a monthly net profit
        of <strong>${formatCurrency(d.netMonthly)}</strong>, a net yield of
        <strong>${formatPercent(d.netYield)}</strong>, and estimated net sale cash of
        <strong>${formatCurrency(d.netSale)}</strong>.
        <br /><br />
        That produces a decision score of <strong>${d.score}/100</strong> and a current verdict of
        <strong>${d.verdict}</strong>.
      </div>
    </div>

    <div class="result-card full">
      <h3>Recommended Next Steps</h3>
      <div class="links-list">
        <a href="#" target="_blank" rel="noopener noreferrer">🏦 Compare buy-to-let mortgage options</a>
        <a href="#" target="_blank" rel="noopener noreferrer">🛡️ Get landlord insurance quotes</a>
        <a href="#" target="_blank" rel="noopener noreferrer">⚡ Review utility and cost savings</a>
        <a href="#" target="_blank" rel="noopener noreferrer">🏠 Explore sale or exit options</a>
      </div>
    </div>
  `;

  document.getElementById("results").innerHTML = resultsHtml;
  document.getElementById("resultsWrap").classList.remove("hidden");
  document.getElementById("resultsWrap").scrollIntoView({ behavior: "smooth", block: "start" });
}

function unlock() {
  const email = document.getElementById("email").value.trim();

  if (!email) {
    alert("Enter your email first.");
    return;
  }

  if (!storedData || !storedData.verdict) {
    alert("Run the calculator first.");
    return;
  }

  if (FORM_ENDPOINT) {
    fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: email,
        verdict: storedData.verdict,
        score: storedData.score,
        monthly_profit: storedData.netMonthly,
        yearly_profit: storedData.yearly,
        equity: storedData.equity,
        net_yield: storedData.netYield,
        net_sale_cash: storedData.netSale
      })
    }).catch((error) => {
      console.error("Lead capture failed:", error);
    });
  }

  renderResults();
}

updatePreview();

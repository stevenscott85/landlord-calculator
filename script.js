let storedData = {};
const FORM_ENDPOINT = "";

/*
  Current simple assumption:
  - Personal-name mode uses a 20% finance-cost credit.
  - This is deliberately shown as a simplified model, not tax advice.
*/
const PERSONAL_FINANCE_COST_CREDIT_RATE = 0.20;

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

function updateTaxHint() {
  const ownershipType = document.getElementById("ownershipType").value;
  const taxHint = document.getElementById("taxHint");

  if (ownershipType === "personal") {
    taxHint.textContent =
      "Personal-name mode uses a simplified finance-cost tax credit model rather than full mortgage-interest deduction.";
  } else {
    taxHint.textContent =
      "Ltd mode treats mortgage interest as deductible for this simplified calculator, while capital repayment still affects cashflow.";
  }
}

function fillDemoData() {
  document.getElementById("ownershipType").value = "personal";
  document.getElementById("tax").value = 40;
  document.getElementById("value").value = 185000;
  document.getElementById("loan").value = 118000;
  document.getElementById("rent").value = 975;
  document.getElementById("mortgagePayment").value = 545;
  document.getElementById("mortgageInterest").value = 380;
  document.getElementById("costs").value = 95;
  document.getElementById("insurance").value = 26;
  document.getElementById("voids").value = 55;
  updateTaxHint();
  updatePreview();
}

function scoreBand(value, bands) {
  for (const band of bands) {
    if (value <= band.max) return band.score;
  }
  return bands[bands.length - 1].score;
}

function getMetricScores(monthlyNetCashflow, netYield, roe, saleCashReturn) {
  const cashflowScore = scoreBand(monthlyNetCashflow, [
    { max: 0, score: 0 },
    { max: 100, score: 20 },
    { max: 200, score: 40 },
    { max: 300, score: 55 },
    { max: 500, score: 75 },
    { max: Infinity, score: 100 }
  ]);

  const netYieldScore = scoreBand(netYield, [
    { max: 0, score: 0 },
    { max: 2, score: 15 },
    { max: 4, score: 40 },
    { max: 6, score: 65 },
    { max: 8, score: 85 },
    { max: Infinity, score: 100 }
  ]);

  const roeScore = scoreBand(roe, [
    { max: 0, score: 0 },
    { max: 3, score: 15 },
    { max: 5, score: 35 },
    { max: 7, score: 55 },
    { max: 10, score: 75 },
    { max: Infinity, score: 100 }
  ]);

  const saleCashReturnScore = scoreBand(saleCashReturn, [
    { max: 0, score: 0 },
    { max: 2, score: 10 },
    { max: 4, score: 30 },
    { max: 6, score: 55 },
    { max: 8, score: 75 },
    { max: Infinity, score: 100 }
  ]);

  return {
    cashflowScore,
    netYieldScore,
    roeScore,
    saleCashReturnScore
  };
}

function buildWeightedScore(metricScores) {
  const weighted =
    metricScores.cashflowScore * 0.35 +
    metricScores.netYieldScore * 0.20 +
    metricScores.roeScore * 0.30 +
    metricScores.saleCashReturnScore * 0.15;

  return Math.round(weighted);
}

function getVerdict(score, monthlyNetCashflow, roe) {
  if (score >= 80 && monthlyNetCashflow > 0 && roe >= 6) {
    return {
      verdict: "STRONG HOLD",
      verdictClass: "score-good",
      verdictText:
        "This looks like a stronger asset: positive cashflow, acceptable return profile, and less obvious pressure to redeploy equity."
    };
  }

  if (score >= 60) {
    return {
      verdict: "HOLD",
      verdictClass: "score-good",
      verdictText:
        "This looks broadly holdable, but you should still compare the return on equity against alternative uses of your capital."
    };
  }

  if (score >= 45) {
    return {
      verdict: "BORDERLINE / REVIEW",
      verdictClass: "score-neutral",
      verdictText:
        "This is not a clean hold. The property needs a serious review on cashflow, yield, and whether your trapped equity is working hard enough."
    };
  }

  return {
    verdict: "CONSIDER SELLING / REDEPLOYING EQUITY",
    verdictClass: "score-bad",
    verdictText:
      "This looks weak on return. The numbers suggest your equity may be underperforming and deserves a serious exit or restructure review."
  };
}

function calculateTaxAndCashflow() {
  const ownershipType = document.getElementById("ownershipType").value;
  const taxRate = getValue("tax") / 100;

  const monthlyRent = getValue("rent");
  const monthlyMortgagePayment = getValue("mortgagePayment");
  const monthlyMortgageInterest = getValue("mortgageInterest");
  const monthlyMaintenance = getValue("costs");
  const monthlyInsurance = getValue("insurance");
  const monthlyVoids = getValue("voids");

  const annualRent = monthlyRent * 12;
  const annualMortgagePayment = monthlyMortgagePayment * 12;
  const annualMortgageInterest = monthlyMortgageInterest * 12;
  const annualNonFinanceCosts = (monthlyMaintenance + monthlyInsurance + monthlyVoids) * 12;

  let annualTax = 0;
  let taxableProfit = 0;
  let financeCostCredit = 0;

  if (ownershipType === "personal") {
    // Simple model:
    // taxable profit before finance-cost restriction
    taxableProfit = annualRent - annualNonFinanceCosts;

    const taxBeforeCredit = Math.max(0, taxableProfit * taxRate);
    financeCostCredit = annualMortgageInterest * PERSONAL_FINANCE_COST_CREDIT_RATE;
    annualTax = Math.max(0, taxBeforeCredit - financeCostCredit);
  } else {
    // Simple company-style model:
    taxableProfit = annualRent - annualNonFinanceCosts - annualMortgageInterest;
    annualTax = Math.max(0, taxableProfit * taxRate);
  }

  const annualAfterTaxCashflow =
    annualRent -
    annualMortgagePayment -
    annualNonFinanceCosts -
    annualTax;

  return {
    ownershipType,
    taxRate,
    annualRent,
    annualMortgagePayment,
    annualMortgageInterest,
    annualNonFinanceCosts,
    taxableProfit,
    financeCostCredit,
    annualTax,
    annualAfterTaxCashflow,
    monthlyAfterTaxCashflow: annualAfterTaxCashflow / 12
  };
}

function updatePreview() {
  const value = getValue("value");
  const loan = getValue("loan");

  const numbers = calculateTaxAndCashflow();

  const equity = value - loan;
  const saleCosts = value * 0.03;
  const netSaleCash = equity - saleCosts;
  const roe = equity > 0 ? (numbers.annualAfterTaxCashflow / equity) * 100 : 0;

  document.getElementById("previewProfit").textContent = formatCurrency(numbers.monthlyAfterTaxCashflow);
  document.getElementById("previewRoe").textContent = formatPercent(roe);
  document.getElementById("previewSale").textContent = formatCurrency(netSaleCash);
}

function calculate() {
  const value = getValue("value");
  const loan = getValue("loan");
  const rent = getValue("rent");
  const mortgagePayment = getValue("mortgagePayment");
  const mortgageInterest = getValue("mortgageInterest");
  const taxField = getValue("tax");

  if (!value || !loan || !rent || !mortgagePayment || !mortgageInterest || !taxField) {
    alert("Fill in Property Value, Mortgage Balance, Monthly Rent, Mortgage Payment, Mortgage Interest and Tax Rate first.");
    return;
  }

  if (mortgageInterest > mortgagePayment) {
    alert("Mortgage interest should not normally be higher than the total mortgage payment.");
    return;
  }

  const numbers = calculateTaxAndCashflow();

  const equity = value - loan;
  const grossYield = value > 0 ? (numbers.annualRent / value) * 100 : 0;
  const netYield = value > 0 ? (numbers.annualAfterTaxCashflow / value) * 100 : 0;

  const saleCosts = value * 0.03;
  const netSaleCash = equity - saleCosts;

  const roe = equity > 0 ? (numbers.annualAfterTaxCashflow / equity) * 100 : 0;
  const saleCashReturn = netSaleCash > 0 ? (numbers.annualAfterTaxCashflow / netSaleCash) * 100 : 0;
  const fiveYearHoldProfit = numbers.annualAfterTaxCashflow * 5;

  const metricScores = getMetricScores(
    numbers.monthlyAfterTaxCashflow,
    netYield,
    roe,
    saleCashReturn
  );

  const overallScore = buildWeightedScore(metricScores);
  const verdictData = getVerdict(overallScore, numbers.monthlyAfterTaxCashflow, roe);

  storedData = {
    value,
    loan,
    rent,
    mortgagePayment,
    mortgageInterest,
    maintenance: getValue("costs"),
    insurance: getValue("insurance"),
    voids: getValue("voids"),
    ownershipType: numbers.ownershipType,
    taxRate: numbers.taxRate,

    annualRent: numbers.annualRent,
    annualMortgagePayment: numbers.annualMortgagePayment,
    annualMortgageInterest: numbers.annualMortgageInterest,
    annualNonFinanceCosts: numbers.annualNonFinanceCosts,
    taxableProfit: numbers.taxableProfit,
    financeCostCredit: numbers.financeCostCredit,
    annualTax: numbers.annualTax,
    monthlyAfterTaxCashflow: numbers.monthlyAfterTaxCashflow,
    annualAfterTaxCashflow: numbers.annualAfterTaxCashflow,

    equity,
    grossYield,
    netYield,
    saleCosts,
    netSaleCash,
    roe,
    saleCashReturn,
    fiveYearHoldProfit,

    cashflowScore: metricScores.cashflowScore,
    netYieldScore: metricScores.netYieldScore,
    roeScore: metricScores.roeScore,
    saleCashReturnScore: metricScores.saleCashReturnScore,

    score: overallScore,
    verdict: verdictData.verdict,
    verdictClass: verdictData.verdictClass,
    verdictText: verdictData.verdictText
  };

  document.getElementById("emailGate").classList.remove("hidden");
  document.getElementById("emailGate").scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildSummaryText(d) {
  return [
    `Ownership: ${d.ownershipType === "personal" ? "Personal Name" : "Ltd Company"}`,
    `Verdict: ${d.verdict} (${d.score}/100)`,
    `Monthly after-tax cashflow: ${formatCurrency(d.monthlyAfterTaxCashflow)}`,
    `Annual after-tax cashflow: ${formatCurrency(d.annualAfterTaxCashflow)}`,
    `Gross yield: ${formatPercent(d.grossYield)}`,
    `Net yield: ${formatPercent(d.netYield)}`,
    `Return on equity: ${formatPercent(d.roe)}`,
    `Return on net sale cash: ${formatPercent(d.saleCashReturn)}`,
    `Equity: ${formatCurrency(d.equity)}`,
    `Estimated net sale cash: ${formatCurrency(d.netSaleCash)}`
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

  const ownershipLabel = d.ownershipType === "personal" ? "Personal Name" : "Ltd Company";

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
      <h3>Monthly After-Tax Cashflow</h3>
      <p class="metric-value">${formatCurrency(d.monthlyAfterTaxCashflow)}</p>
      <p class="metric-sub">This is the actual monthly cash result after costs, mortgage payment and estimated tax.</p>
    </div>

    <div class="result-card">
      <h3>Annual After-Tax Cashflow</h3>
      <p class="metric-value">${formatCurrency(d.annualAfterTaxCashflow)}</p>
      <p class="metric-sub">This is what the property is estimated to put in your pocket over a year.</p>
    </div>

    <div class="result-card">
      <h3>Gross Yield</h3>
      <p class="metric-value">${formatPercent(d.grossYield)}</p>
      <p class="metric-sub">Annual rent divided by property value.</p>
    </div>

    <div class="result-card">
      <h3>Net Yield</h3>
      <p class="metric-value">${formatPercent(d.netYield)}</p>
      <p class="metric-sub">Annual after-tax cashflow divided by property value.</p>
    </div>

    <div class="result-card">
      <h3>Return on Equity</h3>
      <p class="metric-value">${formatPercent(d.roe)}</p>
      <p class="metric-sub">Annual after-tax cashflow divided by equity left in the property.</p>
    </div>

    <div class="result-card">
      <h3>Return on Net Sale Cash</h3>
      <p class="metric-value">${formatPercent(d.saleCashReturn)}</p>
      <p class="metric-sub">Annual after-tax cashflow divided by estimated net sale cash.</p>
    </div>

    <div class="result-card">
      <h3>Equity</h3>
      <p class="metric-value">${formatCurrency(d.equity)}</p>
      <p class="metric-sub">Property value minus mortgage balance.</p>
    </div>

    <div class="result-card">
      <h3>Net Sale Cash</h3>
      <p class="metric-value">${formatCurrency(d.netSaleCash)}</p>
      <p class="metric-sub">Equity after estimated sale costs.</p>
    </div>

    <div class="result-card">
      <h3>Estimated Tax</h3>
      <p class="metric-value">${formatCurrency(d.annualTax)}</p>
      <p class="metric-sub">${ownershipLabel} mode. Simplified estimate only.</p>
    </div>

    <div class="result-card">
      <h3>5-Year Hold Profit</h3>
      <p class="metric-value">${formatCurrency(d.fiveYearHoldProfit)}</p>
      <p class="metric-sub">Simple projection using current annual after-tax cashflow.</p>
    </div>

    <div class="result-card full">
      <h3>Action Summary</h3>
      <div class="summary-box">
        Ownership type: <strong>${ownershipLabel}</strong>.<br /><br />
        This property currently shows estimated monthly after-tax cashflow of
        <strong>${formatCurrency(d.monthlyAfterTaxCashflow)}</strong>, a net yield of
        <strong>${formatPercent(d.netYield)}</strong>, return on equity of
        <strong>${formatPercent(d.roe)}</strong>, and estimated net sale cash of
        <strong>${formatCurrency(d.netSaleCash)}</strong>.
        <br /><br />
        That produces a weighted score of <strong>${d.score}/100</strong> and a current verdict of
        <strong>${d.verdict}</strong>.
      </div>
    </div>

    <div class="result-card full">
      <h3>How the score was built</h3>
      <ul class="score-list">
        <li><strong>35% Monthly Cashflow Score:</strong> ${d.cashflowScore}/100</li>
        <li><strong>20% Net Yield Score:</strong> ${d.netYieldScore}/100</li>
        <li><strong>30% Return on Equity Score:</strong> ${d.roeScore}/100</li>
        <li><strong>15% Return on Net Sale Cash Score:</strong> ${d.saleCashReturnScore}/100</li>
      </ul>
      <p class="metric-sub">
        This means a property with weak return on equity can no longer look good just because equity is high.
      </p>
    </div>

    <div class="result-card full">
      <h3>Tax breakdown used</h3>
      <ul class="score-list">
        <li><strong>Annual rent:</strong> ${formatCurrency(d.annualRent)}</li>
        <li><strong>Annual non-finance costs:</strong> ${formatCurrency(d.annualNonFinanceCosts)}</li>
        <li><strong>Annual mortgage payment:</strong> ${formatCurrency(d.annualMortgagePayment)}</li>
        <li><strong>Annual mortgage interest:</strong> ${formatCurrency(d.annualMortgageInterest)}</li>
        <li><strong>Taxable profit used:</strong> ${formatCurrency(d.taxableProfit)}</li>
        <li><strong>Finance-cost credit used:</strong> ${formatCurrency(d.financeCostCredit)}</li>
        <li><strong>Estimated annual tax:</strong> ${formatCurrency(d.annualTax)}</li>
      </ul>
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
        ownership_type: storedData.ownershipType,
        verdict: storedData.verdict,
        score: storedData.score,
        monthly_after_tax_cashflow: storedData.monthlyAfterTaxCashflow,
        annual_after_tax_cashflow: storedData.annualAfterTaxCashflow,
        net_yield: storedData.netYield,
        return_on_equity: storedData.roe,
        return_on_sale_cash: storedData.saleCashReturn,
        equity: storedData.equity,
        net_sale_cash: storedData.netSaleCash
      })
    }).catch((error) => {
      console.error("Lead capture failed:", error);
    });
  }

  renderResults();
}

updateTaxHint();
updatePreview();

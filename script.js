let storedData = {};
const FORM_ENDPOINT = "";

// For personal-name residential property finance costs, this simplified model
// uses a basic-rate tax credit.
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
      "Ltd mode treats mortgage interest as deductible for this simplified calculator.";
  }
}

function toggleMortgageFields() {
  const mortgageType = document.getElementById("mortgageType").value;
  const paymentLabel = document.getElementById("mortgagePaymentLabel");
  const interestLabel = document.getElementById("mortgageInterestLabel");
  const mortgageHelp = document.getElementById("mortgageHelp");
  const paymentInput = document.getElementById("mortgagePayment");

  if (mortgageType === "interestOnly") {
    paymentLabel.style.display = "none";
    paymentInput.value = "";
    interestLabel.querySelector("span")?.remove();

    interestLabel.childNodes[0].textContent = "Monthly Mortgage Interest / Payment (£)";
    mortgageHelp.textContent =
      "For interest-only mortgages, the interest is effectively the monthly payment used for both cashflow and tax.";
  } else {
    paymentLabel.style.display = "block";
    interestLabel.childNodes[0].textContent = "Monthly Mortgage Interest (£)";
    mortgageHelp.textContent =
      "For repayment mortgages, cashflow uses the full payment but tax uses interest only.";
  }
}

function fillDemoData() {
  document.getElementById("ownershipType").value = "personal";
  document.getElementById("tax").value = 40;
  document.getElementById("value").value = 185000;
  document.getElementById("loan").value = 118000;
  document.getElementById("rent").value = 975;
  document.getElementById("mortgageType").value = "repayment";
  document.getElementById("mortgagePayment").value = 545;
  document.getElementById("mortgageInterest").value = 380;
  document.getElementById("costs").value = 95;
  document.getElementById("insurance").value = 26;
  document.getElementById("voids").value = 55;

  updateTaxHint();
  toggleMortgageFields();
  updatePreview();
}

function scoreBand(value, bands) {
  for (const band of bands) {
    if (value <= band.max) return band.score;
  }
  return bands[bands.length - 1].score;
}

function getMetricScores(monthlyAfterTaxCashflow, netYield, roe) {
  const cashflowScore = scoreBand(monthlyAfterTaxCashflow, [
    { max: 0, score: 0 },
    { max: 100, score: 20 },
    { max: 200, score: 40 },
    { max: 300, score: 60 },
    { max: 500, score: 80 },
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

  return {
    cashflowScore,
    netYieldScore,
    roeScore
  };
}

function buildWeightedScore(metricScores) {
  const weighted =
    metricScores.cashflowScore * 0.4 +
    metricScores.netYieldScore * 0.2 +
    metricScores.roeScore * 0.4;

  return Math.round(weighted);
}

function getRefinanceSignal(equity, roe, monthlyAfterTaxCashflow) {
  if (equity >= 50000 && roe < 6 && monthlyAfterTaxCashflow > 0) {
    return {
      label: "REFINANCE OPPORTUNITY",
      className: "score-neutral",
      text:
        "You appear to have substantial equity with a relatively weak return on equity. A refinance and capital redeployment review may be worth exploring."
    };
  }

  return {
    label: "NO STRONG REFINANCE FLAG",
    className: "score-good",
    text:
      "The current numbers do not create an obvious refinance flag based on this simplified model."
  };
}

function getVerdict(score, monthlyAfterTaxCashflow, roe, refinanceSignal) {
  if (monthlyAfterTaxCashflow < 0) {
    return {
      verdict: "CONSIDER SELLING / RESTRUCTURING",
      verdictClass: "score-bad",
      verdictText:
        "Negative after-tax cashflow is a red flag. Review pricing, costs, finance structure, and whether the asset still deserves your capital."
    };
  }

  if (roe >= 7 && monthlyAfterTaxCashflow > 0 && score >= 70) {
    return {
      verdict: "STRONG HOLD",
      verdictClass: "score-good",
      verdictText:
        "This looks like a stronger asset with decent cashflow and a more acceptable return on equity."
    };
  }

  if (refinanceSignal.label === "REFINANCE OPPORTUNITY") {
    return {
      verdict: "HOLD BUT REVIEW REFINANCE",
      verdictClass: "score-neutral",
      verdictText:
        "The property may be workable, but the trapped equity does not appear to be working especially hard."
    };
  }

  if (score >= 50) {
    return {
      verdict: "HOLD / REVIEW",
      verdictClass: "score-good",
      verdictText:
        "This looks broadly holdable, but you should compare the return on equity against alternative uses of your capital."
    };
  }

  return {
    verdict: "REVIEW SERIOUSLY",
    verdictClass: "score-bad",
    verdictText:
      "The return profile looks weak. Review rent, costs, financing, and whether the equity would perform better elsewhere."
  };
}

function getMortgageInputs() {
  const mortgageType = document.getElementById("mortgageType").value;
  const mortgagePaymentInput = getValue("mortgagePayment");
  const mortgageInterestInput = getValue("mortgageInterest");

  let monthlyMortgagePayment = 0;
  let monthlyMortgageInterest = 0;

  if (mortgageType === "interestOnly") {
    monthlyMortgagePayment = mortgageInterestInput;
    monthlyMortgageInterest = mortgageInterestInput;
  } else {
    monthlyMortgagePayment = mortgagePaymentInput;
    monthlyMortgageInterest = mortgageInterestInput;
  }

  return {
    mortgageType,
    monthlyMortgagePayment,
    monthlyMortgageInterest
  };
}

function calculateTaxAndCashflow() {
  const ownershipType = document.getElementById("ownershipType").value;
  const taxRate = getValue("tax") / 100;

  const monthlyRent = getValue("rent");
  const monthlyMaintenance = getValue("costs");
  const monthlyInsurance = getValue("insurance");
  const monthlyVoids = getValue("voids");

  const mortgage = getMortgageInputs();
  const monthlyMortgagePayment = mortgage.monthlyMortgagePayment;
  const monthlyMortgageInterest = mortgage.monthlyMortgageInterest;

  const annualRent = monthlyRent * 12;
  const annualMortgagePayment = monthlyMortgagePayment * 12;
  const annualMortgageInterest = monthlyMortgageInterest * 12;
  const annualNonFinanceCosts = (monthlyMaintenance + monthlyInsurance + monthlyVoids) * 12;

  let annualTax = 0;
  let taxableProfit = 0;
  let financeCostCredit = 0;

  if (ownershipType === "personal") {
    taxableProfit = annualRent - annualNonFinanceCosts;
    const taxBeforeCredit = Math.max(0, taxableProfit * taxRate);
    financeCostCredit = annualMortgageInterest * PERSONAL_FINANCE_COST_CREDIT_RATE;
    annualTax = Math.max(0, taxBeforeCredit - financeCostCredit);
  } else {
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
    mortgageType: mortgage.mortgageType,
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
  const saleCashBeforeCGT = equity - saleCosts;
  const roe = equity > 0 ? (numbers.annualAfterTaxCashflow / equity) * 100 : 0;

  document.getElementById("previewProfit").textContent = formatCurrency(numbers.monthlyAfterTaxCashflow);
  document.getElementById("previewRoe").textContent = formatPercent(roe);
  document.getElementById("previewSale").textContent = formatCurrency(saleCashBeforeCGT);
}

function calculate() {
  const value = getValue("value");
  const loan = getValue("loan");
  const rent = getValue("rent");
  const taxField = getValue("tax");

  const mortgage = getMortgageInputs();

  if (!value || !loan || !rent || !taxField || !mortgage.monthlyMortgageInterest) {
    alert("Fill in Property Value, Mortgage Balance, Monthly Rent, Tax Rate and the mortgage interest field first.");
    return;
  }

  if (mortgage.mortgageType === "repayment" && !mortgage.monthlyMortgagePayment) {
    alert("For repayment mortgages, enter the full monthly mortgage payment as well.");
    return;
  }

  if (mortgage.monthlyMortgageInterest > mortgage.monthlyMortgagePayment && mortgage.mortgageType === "repayment") {
    alert("For repayment mortgages, monthly interest should not normally be higher than the full monthly payment.");
    return;
  }

  const numbers = calculateTaxAndCashflow();
  const equity = value - loan;
  const grossYield = value > 0 ? (numbers.annualRent / value) * 100 : 0;
  const netYield = value > 0 ? (numbers.annualAfterTaxCashflow / value) * 100 : 0;
  const saleCosts = value * 0.03;
  const saleCashBeforeCGT = equity - saleCosts;
  const roe = equity > 0 ? (numbers.annualAfterTaxCashflow / equity) * 100 : 0;
  const fiveYearHoldProfit = numbers.annualAfterTaxCashflow * 5;

  const metricScores = getMetricScores(
    numbers.monthlyAfterTaxCashflow,
    netYield,
    roe
  );

  const overallScore = buildWeightedScore(metricScores);
  const refinanceSignal = getRefinanceSignal(equity, roe, numbers.monthlyAfterTaxCashflow);
  const verdictData = getVerdict(overallScore, numbers.monthlyAfterTaxCashflow, roe, refinanceSignal);

  storedData = {
    value,
    loan,
    rent,
    ownershipType: numbers.ownershipType,
    mortgageType: numbers.mortgageType,
    taxRate: numbers.taxRate,

    maintenance: getValue("costs"),
    insurance: getValue("insurance"),
    voids: getValue("voids"),

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
    saleCashBeforeCGT,
    roe,
    fiveYearHoldProfit,

    cashflowScore: metricScores.cashflowScore,
    netYieldScore: metricScores.netYieldScore,
    roeScore: metricScores.roeScore,

    refinanceSignal,
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
    `Mortgage type: ${d.mortgageType === "interestOnly" ? "Interest Only" : "Repayment"}`,
    `Verdict: ${d.verdict} (${d.score}/100)`,
    `Monthly after-tax cashflow: ${formatCurrency(d.monthlyAfterTaxCashflow)}`,
    `Annual after-tax cashflow: ${formatCurrency(d.annualAfterTaxCashflow)}`,
    `Gross yield: ${formatPercent(d.grossYield)}`,
    `Net yield: ${formatPercent(d.netYield)}`,
    `Return on equity: ${formatPercent(d.roe)}`,
    `Equity: ${formatCurrency(d.equity)}`,
    `Sale cash before CGT: ${formatCurrency(d.saleCashBeforeCGT)}`
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
  const mortgageLabel = d.mortgageType === "interestOnly" ? "Interest Only" : "Repayment";

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
      <h3>Refinance Signal</h3>
      <div class="score-box">
        <span class="score-pill ${d.refinanceSignal.className}">${d.refinanceSignal.label}</span>
      </div>
      <p class="metric-sub">${d.refinanceSignal.text}</p>
    </div>

    <div class="result-card">
      <h3>Monthly After-Tax Cashflow</h3>
      <p class="metric-value">${formatCurrency(d.monthlyAfterTaxCashflow)}</p>
      <p class="metric-sub">What the property is estimated to leave you with each month after tax.</p>
    </div>

    <div class="result-card">
      <h3>Annual After-Tax Cashflow</h3>
      <p class="metric-value">${formatCurrency(d.annualAfterTaxCashflow)}</p>
      <p class="metric-sub">Estimated yearly cash result after tax.</p>
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
      <h3>Equity Left In</h3>
      <p class="metric-value">${formatCurrency(d.equity)}</p>
      <p class="metric-sub">Property value minus mortgage balance.</p>
    </div>

    <div class="result-card">
      <h3>Sale Cash Before CGT</h3>
      <p class="metric-value">${formatCurrency(d.saleCashBeforeCGT)}</p>
      <p class="metric-sub">Estimated equity after selling costs, before any CGT calculation.</p>
    </div>

    <div class="result-card">
      <h3>Estimated Annual Tax</h3>
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
        Ownership type: <strong>${ownershipLabel}</strong>.<br />
        Mortgage type: <strong>${mortgageLabel}</strong>.<br /><br />
        This property currently shows estimated monthly after-tax cashflow of
        <strong>${formatCurrency(d.monthlyAfterTaxCashflow)}</strong>, a net yield of
        <strong>${formatPercent(d.netYield)}</strong>, return on equity of
        <strong>${formatPercent(d.roe)}</strong>, and sale cash before CGT of
        <strong>${formatCurrency(d.saleCashBeforeCGT)}</strong>.
        <br /><br />
        That produces a weighted score of <strong>${d.score}/100</strong> and a current verdict of
        <strong>${d.verdict}</strong>.
      </div>
    </div>

    <div class="result-card full">
      <h3>How the score was built</h3>
      <ul class="score-list">
        <li><strong>40% Monthly Cashflow Score:</strong> ${d.cashflowScore}/100</li>
        <li><strong>20% Net Yield Score:</strong> ${d.netYieldScore}/100</li>
        <li><strong>40% Return on Equity Score:</strong> ${d.roeScore}/100</li>
      </ul>
      <p class="metric-sub">
        This version is deliberately simpler. It focuses on pocket cashflow and how hard your equity is actually working.
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
        <a href="#" target="_blank" rel="noopener noreferrer">🔁 Explore refinance options</a>
        <a href="#" target="_blank" rel="noopener noreferrer">🛡️ Get landlord insurance quotes</a>
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
        mortgage_type: storedData.mortgageType,
        verdict: storedData.verdict,
        score: storedData.score,
        monthly_after_tax_cashflow: storedData.monthlyAfterTaxCashflow,
        annual_after_tax_cashflow: storedData.annualAfterTaxCashflow,
        net_yield: storedData.netYield,
        return_on_equity: storedData.roe,
        equity: storedData.equity,
        sale_cash_before_cgt: storedData.saleCashBeforeCGT,
        refinance_flag: storedData.refinanceSignal.label
      })
    }).catch((error) => {
      console.error("Lead capture failed:", error);
    });
  }

  renderResults();
}

updateTaxHint();
toggleMortgageFields();
updatePreview();

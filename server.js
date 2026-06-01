/**
 * Authsnap Grant Scout — Railway Server
 * Deploy to Railway, set env var: ANTHROPIC_API_KEY
 */

const http = require('http');

const PORT = process.env.PORT || 8080;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

async function handleScan(body) {
  const { category = 'all', keywords = '', fundingMin = 0, existingIds = [] } = body;

  const systemPrompt = `You are a grant research agent for Authsnap — an AI-powered medical claims appeal automation company in Marquette, Michigan (rural Upper Peninsula).

Authsnap uses patent-pending Clinical AI to automatically appeal denied insurance claims, recovering up to 75% of lost revenue for healthcare providers in 48 hours. They serve specialty practices, rural hospitals, independent medical groups. They won CORI's 2025 Small Towns Big Ideas Rural Pitch Competition.

Search the web RIGHT NOW for real, live, currently-open grant opportunities and funding programs that Authsnap could apply for or partner on.

Search these sources every time:
- grants.gov (search "health IT", "revenue cycle", "rural health technology", "clinical AI")
- Foundation websites: Elevance, BCBS plans, UnitedHealth, Aetna, Cigna, Humana, Centene foundations
- NSF seedfund.nsf.gov for SBIR/STTR AI and health topics
- NIH seed.nih.gov for SBIR/STTR AHRQ and NCI tracks
- HRSA grants for rural health (hrsa.gov)
- Michigan MEDC and state innovation programs
- Healthcare innovation competitions and prizes
- AHA (American Hospital Association) grant programs
- rwjf.org (Robert Wood Johnson Foundation)
- ONC (Office of National Coordinator for Health IT) grants
- innovation.cms.gov for CMMI models

Return ONLY a raw JSON array — no markdown, no code fences, no explanation, just [ ... ].

Each grant object must have EXACTLY these fields:
{
  "id": "unique-kebab-slug",
  "title": "Full official grant program name",
  "funder": "Funder organization name",
  "tier": "tier1",
  "amount": "e.g. $275K–$1M",
  "deadline": "e.g. September 5, 2026 or Rolling",
  "status": "open",
  "category": "government",
  "description": "2-3 sentences explaining specifically why this fits Authsnap",
  "apply_url": "https://direct-url-to-apply",
  "contact": "email@example.com or contact page URL",
  "notes": "One critical Authsnap-specific action item or warning"
}

Tier: tier1 = direct strong fit + high $, tier2 = good fit or moderate $, tier3 = partner/indirect
Status: urgent = deadline <60 days, open = currently accepting, watch = upcoming, closed = passed

Return 8–15 results. Prioritize ones with open deadlines. Only include grants you can verify exist.`;

  const excludeList = existingIds.length > 0
    ? `\n\nDo NOT return grants with these IDs (already in database): ${existingIds.join(', ')}`
    : '';

  const userPrompt = `Search the web today for NEW grant opportunities for Authsnap healthcare AI company.

Filters:
- Category: ${category === 'all' ? 'all — government, foundation, rural health, competitions' : category}
- Minimum funding: ${fundingMin > 0 ? '$' + Number(fundingMin).toLocaleString() : 'no minimum'}
${keywords ? '- Keywords: ' + keywords : ''}
${excludeList}

Search broadly. Check grants.gov right now. Check foundation websites. Look for anything posted or updated in the last 90 days. Return JSON array only.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: systemPrompt,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Anthropic API error ' + response.status);
  }

  const data = await response.json();

  const searches = data.content
    .filter(b => b.type === 'tool_use')
    .map(b => b.input?.query)
    .filter(Boolean);

  const fullText = data.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  let grants = [];
  const match = fullText.match(/\[[\s\S]*\]/);
  if (match) {
    grants = JSON.parse(match[0]);
  } else {
    grants = JSON.parse(fullText.replace(/```json|```/g, '').trim());
  }

  if (!Array.isArray(grants)) throw new Error('Response was not a JSON array');

  if (fundingMin > 0) {
    grants = grants.filter(g => {
      const nums = (g.amount || '').replace(/[^0-9]/g, ' ').trim().split(/\s+/).map(Number).filter(Boolean);
      return nums.length === 0 || nums.some(n => n >= fundingMin);
    });
  }

  return { grants, searches, count: grants.length, scannedAt: new Date().toISOString() };
}

const server = http.createServer(async (req, res) => {

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET') {
    res.writeHead(200, CORS_HEADERS);
    res.end(JSON.stringify({ status: 'ok', service: 'Authsnap Grant Scout', time: new Date().toISOString() }));
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, CORS_HEADERS);
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  // Read body
  let rawBody = '';
  req.on('data', chunk => rawBody += chunk);
  req.on('end', async () => {
    let body = {};
    try { body = JSON.parse(rawBody || '{}'); } catch {
      res.writeHead(400, CORS_HEADERS);
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      res.writeHead(500, CORS_HEADERS);
      res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY environment variable not set' }));
      return;
    }

    try {
      const result = await handleScan(body);
      res.writeHead(200, CORS_HEADERS);
      res.end(JSON.stringify(result));
    } catch (err) {
      console.error('Scan error:', err.message);
      res.writeHead(500, CORS_HEADERS);
      res.end(JSON.stringify({ error: err.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`Authsnap Grant Scout running on port ${PORT}`);
  console.log(`API key configured: ${process.env.ANTHROPIC_API_KEY ? 'YES' : 'NO — set ANTHROPIC_API_KEY'}`);
});

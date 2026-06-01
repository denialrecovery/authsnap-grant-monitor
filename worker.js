/**
 * Authsnap Grant Scout — Cloudflare Worker
 * Deploy at: https://workers.cloudflare.com (free tier)
 * Set environment variable: ANTHROPIC_API_KEY = your key
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    // Health check
    if (request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'ok', service: 'Authsnap Grant Scout' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS });
    }

    let body;
    try { body = await request.json(); } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    const { category = 'all', keywords = '', fundingMin = 0, existingIds = [] } = body;

    const systemPrompt = `You are a grant research agent for Authsnap — an AI-powered medical claims appeal automation company in Marquette, Michigan (rural Upper Peninsula).

Authsnap uses patent-pending Clinical AI to automatically appeal denied insurance claims, recovering up to 75% of lost revenue for healthcare providers in 48 hours. They serve specialty practices, rural hospitals, independent medical groups. They won CORI's 2025 Small Towns Big Ideas Rural Pitch Competition.

Your job: search the web RIGHT NOW for real, live, currently-open grant opportunities and funding programs that Authsnap could apply for or partner on.

Search these sources every time:
- grants.gov (search "health IT", "revenue cycle", "rural health technology", "clinical AI")
- foundation websites: Elevance, BCBS plans, UnitedHealth, Aetna, Cigna, Humana, Centene foundations
- NSF seedfund.nsf.gov for SBIR/STTR AI and health topics
- NIH seed.nih.gov for SBIR/STTR AHRQ and NCI tracks
- HRSA grants for rural health
- Michigan MEDC and state innovation programs
- Healthcare innovation competitions and prizes
- AHA (American Hospital Association) grant programs
- rwjf.org (Robert Wood Johnson Foundation)
- ONC (Office of National Coordinator for Health IT) grants

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

Tier: tier1 = direct strong fit + high $, tier2 = good fit or moderate $, tier3 = partner/indirect play
Status: urgent = deadline <60 days, open = currently accepting, watch = upcoming, closed = passed

Return 8–15 results. Prioritize ones with open deadlines. Only include grants you can verify exist right now.`;

    const excludeList = existingIds.length > 0
      ? `\n\nDo NOT return grants with these IDs (already in database): ${existingIds.join(', ')}`
      : '';

    const userPrompt = `Search the web today for NEW grant opportunities for Authsnap healthcare AI company.

Filters applied:
- Category focus: ${category === 'all' ? 'all categories — government, foundation, rural health, competitions, contracts' : category}
- Minimum funding: ${fundingMin > 0 ? '$' + Number(fundingMin).toLocaleString() : 'no minimum'}
${keywords ? '- Keywords to prioritize: ' + keywords : ''}
${excludeList}

Search broadly. Check grants.gov right now. Check foundation websites. Look for anything posted or updated in the last 90 days. Return JSON array only.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
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
        const err = await response.json();
        return new Response(JSON.stringify({ error: err.error?.message || 'Anthropic API error', status: response.status }), {
          status: 502, headers: { ...CORS, 'Content-Type': 'application/json' }
        });
      }

      const data = await response.json();

      // Extract tool use queries for logging
      const searches = data.content
        .filter(b => b.type === 'tool_use')
        .map(b => b.input?.query)
        .filter(Boolean);

      // Extract text response
      const fullText = data.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('');

      // Parse JSON from response
      let grants = [];
      const match = fullText.match(/\[[\s\S]*\]/);
      if (match) {
        grants = JSON.parse(match[0]);
      } else {
        const cleaned = fullText.replace(/```json|```/g, '').trim();
        grants = JSON.parse(cleaned);
      }

      if (!Array.isArray(grants)) throw new Error('Response was not a JSON array');

      // Filter by funding minimum if set
      if (fundingMin > 0) {
        grants = grants.filter(g => {
          const nums = (g.amount || '').replace(/[^0-9]/g, ' ').trim().split(/\s+/).map(Number).filter(Boolean);
          return nums.length === 0 || nums.some(n => n >= fundingMin);
        });
      }

      return new Response(JSON.stringify({
        grants,
        searches,
        count: grants.length,
        scannedAt: new Date().toISOString(),
      }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }
  }
};

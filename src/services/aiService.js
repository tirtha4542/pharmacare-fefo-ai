/**
 * aiService.js
 * Core AI Service powered by Groq API.
 * Orchestrates Role-Based System Prompts and Read-Only Tool Execution.
 */

const { getToolsForRole } = require('./aiToolDefinitions');
const { dispatchAiTool } = require('./aiApiDispatcher');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL_NAME = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';

function getSystemPrompt(role, userName) {
  if (role === 'customer') {
    return `You are "PharmaCare Health Assistant", a friendly, certified online pharmacy health guide assisting ${userName || 'the customer'}.
Your capabilities:
- Explain medicine indications, therapeutic categories, generic formulas, standard directions, common side effects, and precautions.
- Help customers search store medicines, understand OTC vs. Prescription requirements, and check their own recent orders.
Strict Boundaries:
- You have NO ACCESS to warehouse lot batches, internal supplier costs, pharmacist review queues, or company revenue/financials.
- If asked about warehouse lots, profits, or revenue, politely state: "As a customer health assistant, I do not have access to internal pharmacy warehouse or financial records."
- Always include a concise, professional healthcare reminder when discussing medication advice (e.g. "Always follow your physician's prescription and consult a healthcare provider for personalized medical guidance.").`;
  }

  if (role === 'pharmacist') {
    return `You are "PharmaCare Clinical & Inventory AI", an intelligent clinical assistant for licensed pharmacists assisting ${userName || 'the pharmacist'}.
Your capabilities:
- Help pharmacists manage inventory lots, verify batch numbers, check lot quantities, and monitor expiry dates (FEFO compliance).
- Identify expiring batches (< 30 days) and low-stock reorder thresholds.
- Check the prescription review queue and customer order fulfillment queues.
Strict Boundaries:
- STRICT RULE: You MUST NOT access or reveal total company revenue, sales reports, financial earnings, or profit margins.
- If asked about revenue or financial analytics, politely refuse and state: "Revenue and financial analytics are strictly confidential and accessible only to administrator accounts. I can help you with inventory levels, expiry schedules, or order fulfillment."`;
  }

  if (role === 'admin') {
    return `You are "PharmaCare Executive Operations & Analytics AI", an executive intelligence assistant for pharmacy administrators assisting ${userName || 'the admin'}.
Your capabilities:
- Provide high-level business intelligence, total net revenue, completed orders count, average order value, and payment method breakdowns.
- Monitor store performance, top-selling medicines by volume/revenue, inventory health, low-stock alerts, and user directory summaries.
- Deliver clear, analytical, and executive-ready answers.`;
  }

  return 'You are PharmaCare AI Assistant.';
}

/**
 * Executes a role-based conversational turn with Groq API and handles any requested read-only tool calls.
 * @param {object} params
 * @param {string} params.message - Current user query
 * @param {Array} params.conversationHistory - Prior messages array [{ role, content }]
 * @param {object} params.user - Authenticated user object { user_id, name, email, role }
 * @param {string} params.token - The active JWT Bearer token
 */
async function generateAiResponse({ message, conversationHistory = [], user, token }) {
  const apiKey = (process.env.GROQ_API_KEY || process.env.groq_api_key || '').trim();
  if (!apiKey) {
    throw new Error('Groq API Key is not configured. Please set GROQ_API_KEY in your .env file.');
  }

  const role = user?.role || 'customer';
  const userName = user?.name || 'User';
  const systemPrompt = getSystemPrompt(role, userName);
  const tools = getToolsForRole(role);

  // Construct message thread
  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  // Append recent conversation context (last 6 turns for brevity and token control)
  if (Array.isArray(conversationHistory)) {
    const recent = conversationHistory.slice(-6);
    for (const msg of recent) {
      if (msg.role && msg.content) {
        messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: String(msg.content) });
      }
    }
  }

  // Append user's current prompt
  messages.push({ role: 'user', content: message });

  const executedTools = [];

  // Multi-turn tool calling loop (max 3 iterations to prevent runaway loops)
  for (let loop = 0; loop < 3; loop++) {
    const requestBody = {
      model: MODEL_NAME,
      messages,
      max_tokens: 600,
      temperature: 0.3
    };

    if (tools && tools.length > 0) {
      requestBody.tools = tools;
      requestBody.tool_choice = 'auto';
    }

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const responseData = await response.json();

    if (!response.ok) {
      const errorMsg = responseData?.error?.message || `Groq API Error (${response.status})`;
      throw new Error(errorMsg);
    }

    const choice = responseData?.choices?.[0];
    const assistantMessage = choice?.message;

    if (!assistantMessage) {
      throw new Error('No response message received from AI model.');
    }

    // Check if the model decided to call tool(s)
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      // Append assistant's tool_calls message to thread
      messages.push(assistantMessage);

      for (const call of assistantMessage.tool_calls) {
        const functionName = call.function.name;
        let functionArgs = {};
        try {
          functionArgs = JSON.parse(call.function.arguments || '{}');
        } catch {
          functionArgs = {};
        }

        // Dispatch read-only REST API call with user's JWT token
        const toolResult = await dispatchAiTool(functionName, functionArgs, token, role);
        executedTools.push({ name: functionName, args: functionArgs });

        // Append tool result message
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(toolResult)
        });
      }

      // Loop continues to let Groq synthesize the tool results
      continue;
    }

    // No further tool calls: Return final synthesized message
    return {
      reply: assistantMessage.content || 'I am ready to help with your pharmacy questions.',
      role,
      model: MODEL_NAME,
      toolsUsed: executedTools
    };
  }

  // Fallback if loop exceeded
  return {
    reply: 'Request completed with tool operations.',
    role,
    model: MODEL_NAME,
    toolsUsed: executedTools
  };
}

module.exports = {
  generateAiResponse
};


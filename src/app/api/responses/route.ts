import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Proxy endpoint for the OpenAI Responses API
export async function POST(req: NextRequest) {
  const body = await req.json();

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // This routing logic is correct. It correctly identifies that the guardrail
  // needs a structured JSON response and sends it to the right function.
  if (body.text?.format?.type === 'json_schema') {
    return await structuredResponse(openai, body);
  } else {
    return await textResponse(openai, body);
  }
}

// --- HIGHLIGHT: THIS ENTIRE FUNCTION IS REWRITTEN ---
async function structuredResponse(openai: OpenAI, body: any) {
  try {
    // FIX 1: Use the correct SDK method `chat.completions.create`.
    // This method takes a prompt and generates a new response.
    const response = await openai.chat.completions.create({
      // FIX 2: Pass the model and input messages correctly.
      model: body.model,
      messages: body.input, // The 'input' from the guardrail maps to 'messages' here.

      // FIX 3: Tell the model to output a JSON object.
      // This ensures the response content is a valid, parseable JSON string.
      response_format: { type: 'json_object' },
    });

    // FIX 4: The response from `chat.completions.create` needs to be processed
    // to match the format the client-side code expects.
    const messageContent = response.choices[0]?.message?.content;
    if (!messageContent) {
      throw new Error('OpenAI response did not contain message content.');
    }

    // Parse the JSON string from the model's response.
    const parsedJson = JSON.parse(messageContent);

    // The client code (`guardrails.ts`) expects the final object to be in a
    // property named `output_parsed`. We create that structure here.
    return NextResponse.json({ output_parsed: parsedJson });

  } catch (err: any) {
    console.error('Error in structuredResponse proxy:', err);
    return NextResponse.json({ error: 'failed to get structured response' }, { status: 500 });
  }
}

// This function is unchanged as it was not part of the bug.
async function textResponse(openai: OpenAI, body: any) {
  try {
    const response = await openai.responses.create({
      ...(body as any),
      stream: false,
    });

    return NextResponse.json(response);
  } catch (err: any) {
    console.error('Error in textResponse proxy:', err);
    return NextResponse.json({ error: 'failed to get text response' }, { status: 500 });
  }
}
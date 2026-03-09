import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';
import { verifyJWT } from '@/lib/auth-users';

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('karma_session')?.value;

        if (!token) {
            return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
        }

        const session = verifyJWT(token);
        if (!session) {
            return NextResponse.json({ error: 'Invalid or expired session.' }, { status: 401 });
        }

        const { query, documentContext, documentBase64, documentType } = await request.json();

        if (!query) {
            return NextResponse.json({ error: 'Query is required' }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("GEMINI_API_KEY environment variable is not set.");
            return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
        }

        // Use gemini-2.5-flash as the default model
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        // Construct the prompt with context
        const prompt = `
You are the "Karma AI Extractor", an intelligent assistant analyzing Service Level Agreement (SLA) documents for restoration jobs.

Context (Information from the current SLA document being viewed):
${documentContext ? documentContext : "No specific document context provided. Answer generally about restoration SLA guidelines."}

User Question:
${query}

Please provide a clear, professional, and concise answer based ONLY on the attached document context. 
If the document does not contain the answer, state that clearly but provide a reasonable general guideline if applicable. Make sure to precisely cite the rules where possible.

IMPORTANT FORMATTING INSTRUCTIONS:
- Always format your response using Markdown.
- Use **bold text** for key terms, times, and important numbers.
- If listing multiple rules, conditions, or steps, ALWAYS use bullet points.
- Keep the response easy to read and spaced out.
`;

        const parts: any[] = [];

        // If a document was provided as base64, attach it to the Gemini payload natively
        if (documentBase64) {
            parts.push({
                inlineData: {
                    mimeType: documentType || "application/pdf",
                    data: documentBase64
                }
            });
        }

        parts.push({ text: prompt });

        const payload = {
            contents: [{
                parts: parts
            }]
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            console.error("Gemini API Error:", errorData || response.statusText);
            throw new Error(`Gemini API returned status: ${response.status}`);
        }

        const data = await response.json();

        // Extract the text response from Gemini's payload structure
        const aiResponseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "I was unable to generate a response. Please try again.";

        // --- AGENT 2: KARMA AUDITOR (Validation) ---
        let validationData = null;
        if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            try {
                const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
                if (!anthropicApiKey) {
                    console.error("ANTHROPIC_API_KEY environment variable is not set.");
                    throw new Error("Missing Anthropic API Key");
                }

                const anthropic = new Anthropic({
                    apiKey: anthropicApiKey,
                });

                const validationPrompt = `
You are the "Karma Auditor", a high-precision quality control agent for insurance Service Level Agreements (SLAs).

TASK:
Your sole purpose is to verify the accuracy of a previously extracted answer. You must compare the "Proposed Answer" against the "Original Document Context" and identify any inaccuracies, missing conditions, or hallucinations.

Original Document Context:
${documentContext ? documentContext : "No specific document context provided. Check for general logical consistency."}

Proposed Answer from Extractor Agent:
${aiResponseText}

Original User Question:
${query}

VALIDATION STEPS:
1. TRUTH CHECK: Does the Proposed Answer contradict any specific numbers, timelines (e.g., 24-hour response), or requirements in the Context?
2. OMISSION CHECK: Did the Proposed Answer miss a critical "condition" (e.g., "only if the water is Category 3")?
3. SOURCE VERIFICATION: Can you find the exact sentence in the Context that supports this answer?

RESPONSE FORMAT:
Please return your response STRICTLY as a JSON object with the following keys, and no markdown formatting block around it:
{
  "status": "MATCH" | "MISMATCH" | "INCOMPLETE",
  "correction": "If Mismatch or Incomplete, provide the corrected text here. If Match, leave empty string.",
  "sourceQuote": "Directly quote the line from the document that proves the answer, or empty string if none.",
  "confidenceScore": 95
}
`;

                // We're only sending text and documentContext to the Auditor to avoid base64 errors
                const content: Anthropic.ContentBlockParam[] = [];
                
                content.push({ type: "text", text: validationPrompt });

                const validationResponse = await anthropic.messages.create({
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content }],
                });

                const contentBlock = validationResponse.content[0];
                const vText = contentBlock.type === 'text' ? contentBlock.text : "";
                
                if (vText) {
                    try {
                        validationData = JSON.parse(vText);
                    } catch (e) {
                        console.error("Failed to parse Karma Auditor JSON:", vText);
                    }
                }
            } catch (auditError) {
                console.error("Karma Auditor failed:", auditError);
                // We don't throw here so we can still return the primary answer
            }
        }

        // --- AGENT 3: THE JUDGE (Arbitration Logic) ---
        function theJudge(agent1Response: string, agent2Response: any) {
            // Default if auditor fails
            if (!agent2Response) {
                return {
                    finalAnswer: agent1Response,
                    status: "Auditor Unavailable"
                };
            }

            // 1. If Auditor says it's a perfect match, trust Agent 1
            if (agent2Response.status === "MATCH" && agent2Response.confidenceScore > 90) { // Using 90 instead of 0.9 since prompt asks for 0-100%
                return {
                    finalAnswer: agent1Response,
                    status: "Verified by AI"
                };
            }

            // 2. If Auditor found an error and is confident in the fix
            if (agent2Response.status === "MISMATCH" && agent2Response.correction) {
                return {
                    finalAnswer: agent2Response.correction,
                    status: "AI Corrected"
                };
            }

            // 3. If they disagree and confidence is low, send to a Human (Karma Staff)
            if (agent2Response.status === "INCOMPLETE" || agent2Response.confidenceScore < 70) {
                return {
                    finalAnswer: "Our AI agents are debating this one. Please check the original SLA PDF for safety.",
                    status: "Needs Human Review"
                };
            }

            // Fallback
            return {
                finalAnswer: agent1Response,
                status: "Pending Verified"
            };
        }

        const judgeResult = theJudge(aiResponseText, validationData);

        return NextResponse.json({
            result: judgeResult.finalAnswer,
            judgeStatus: judgeResult.status,
            validation: validationData
        });

    } catch (error) {
        console.error("Error in Gemini API route:", error);
        return NextResponse.json({ error: 'Failed to process AI request' }, { status: 500 });
    }
}

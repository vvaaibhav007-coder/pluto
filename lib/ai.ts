export async function categorizeUrl(url: string, title: string): Promise<string> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    console.warn('MINIMAX_API_KEY is not set');
    return 'Uncategorized';
  }

  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-8b-instruct',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that categorizes bookmarks. Given a URL and its title, return a single category name that best describes it. Examples: "Technology", "Social Media", "Shopping", "News", "Entertainment", "Education", "Development". Reply with ONLY the category name.'
          },
          {
            role: 'user',
            content: `Categorize this bookmark:\nURL: ${url}\nTitle: ${title}`
          }
        ],
        temperature: 0.1,
        max_tokens: 50,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error('Failed to categorize:', await response.text());
      return 'Uncategorized';
    }

    const data = await response.json();

    // Safely navigate the response — API format may vary
    const category = data?.choices?.[0]?.message?.content?.trim();
    if (!category) {
      console.warn('Unexpected AI response shape:', JSON.stringify(data).slice(0, 300));
      return 'Uncategorized';
    }

    return category;
  } catch (error) {
    console.error('Error in categorizeUrl:', error);
    return 'Uncategorized';
  }
}

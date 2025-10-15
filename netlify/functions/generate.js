// OpenAI API 요청을 처리할 서버리스 함수
exports.handler = async function (event, context) {
    // POST 요청만 허용
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    // Netlify 환경 변수에서 API 키를 가져옴
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'API 키가 서버에 설정되지 않았습니다.' })
        };
    }

    try {
        const { prompt } = JSON.parse(event.body);

        if (!prompt) {
             return {
                statusCode: 400,
                body: JSON.stringify({ error: '요청 본문에 prompt가 필요합니다.' })
            };
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('OpenAI API Error:', errorData);
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: `OpenAI API 요청 실패: ${errorData.error?.message || response.statusText}` })
            };
        }

        const data = await response.json();
        const resultText = data.choices[0]?.message?.content;

        return {
            statusCode: 200,
            body: JSON.stringify({ result: resultText })
        };

    } catch (error) {
        console.error('Serverless Function Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: '서버 내부 오류가 발생했습니다.' })
        };
    }
};

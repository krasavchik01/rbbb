const fetch = require('node-fetch');

// Замените эти данные на админские (или специально созданного пользователя CRM)
const SEAFILE_URL = process.env.SEAFILE_URL;
const USERNAME = process.env.SEAFILE_USERNAME;
const PASSWORD = process.env.SEAFILE_PASSWORD;

const missingEnv = [
    ['SEAFILE_URL', SEAFILE_URL],
    ['SEAFILE_USERNAME', USERNAME],
    ['SEAFILE_PASSWORD', PASSWORD],
].filter(([, value]) => !value).map(([name]) => name);

if (missingEnv.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnv.join(', ')}`);
}

async function getToken() {
    console.log(`📡 Подключение к ${SEAFILE_URL}/api2/auth-token/ ...`);

    try {
        const response = await fetch(`${SEAFILE_URL}/api2/auth-token/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                username: USERNAME,
                password: PASSWORD
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Ошибка авторизации:', response.status, response.statusText);
            console.error(errorText);
            return;
        }

        const data = await response.json();
        console.log('✅ УСПЕШНО! Ваш API Token:');
        console.log('\n=========================================');
        console.log(data.token);
        console.log('=========================================\n');
        console.log('Сохраните этот токен в переменную окружения SEAFILE_TOKEN, не вставляйте его в код.');

    } catch (error) {
        console.error('❌ Ошибка выполнения запроса:', error.message);
    }
}

getToken();

const fetch = require('node-fetch');

// Замените эти данные на админские (или специально созданного пользователя CRM)
const SEAFILE_URL = 'https://cloud.rbpartners.kz';
const USERNAME = 'ВАШ_ЛОГИН_ОТ_SEAFILE';
const PASSWORD = 'ВАШ_ПАРОЛЬ_ОТ_SEAFILE';

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
        console.log('Сохраните этот токен! Мы будем использовать его в коде.');

    } catch (error) {
        console.error('❌ Ошибка выполнения запроса:', error.message);
    }
}

getToken();

const { spawn } = require('child_process');
const path = require('path');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Função para executar um script
function runScript(scriptPath) {
    return new Promise((resolve, reject) => {
        const process = spawn('node', [scriptPath]);

        process.stdout.on('data', (data) => {
            console.log(`${path.basename(scriptPath)}: ${data}`);
        });

        process.stderr.on('data', (data) => {
            console.error(`${path.basename(scriptPath)} error: ${data}`);
        });

        process.on('close', (code) => {
            if (code !== 0) {
                console.log(`${path.basename(scriptPath)} process exited with code ${code}`);
                reject(code);
            } else {
                resolve();
            }
        });
    });
}

// Endpoint de healthcheck
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Background service is running' });
});

// Função principal que executa os scripts em paralelo
async function main() {
    try {
        // Inicia o servidor web
        app.listen(port, () => {
            console.log(`Background service listening on port ${port}`);
        });

        // Inicia o monitor em background
        runScript(path.join(__dirname, '../monitor.js')).catch(console.error);

        // Executa a limpeza a cada 24 horas
        while (true) {
            await runScript(path.join(__dirname, 'scheduleCleanup.js'));
            await new Promise(resolve => setTimeout(resolve, 24 * 60 * 60 * 1000)); // 24 horas
        }
    } catch (error) {
        console.error('Error in worker:', error);
        process.exit(1);
    }
}

main().catch(console.error); 
import https from 'https'

const TARGET_HOST = 'clyo.weexnes.dev'

async function runTests() {
    console.log(`Rate Limit Testing Script for https://${TARGET_HOST}\n`)
    
    // 1. Test Login Rate Limiting (5 attempts allowed, 6th blocked)
    console.log('--- 1. Testing Login Rate Limiting (5 max attempts / 15 mins) ---')
    for (let i = 1; i <= 6; i++) {
        const res = await sendRequest('/api/login', 'POST', { username: 'admin', password: 'wrong_password' })
        console.log(`Attempt ${i}: Status = ${res.statusCode}, Message = "${res.body.statusMessage || res.body.message || ''}"`)
        if (res.statusCode === 429) {
            console.log('✓ Login rate limiting triggered successfully!')
            break
        }
        await new Promise(r => setTimeout(r, 100))
    }

    // 2. Test API Rate Limiting (1000 attempts allowed for unauthenticated requests, 1001st blocked)
    console.log('\n--- 2. Testing API Rate Limiting (1000 max unauthenticated requests / 1 min) ---')
    console.log('Sending 1005 concurrent unauthenticated requests to /api/verify to trigger the limit...')
    
    const start = Date.now()
    const batches = 11
    const batchSize = 100
    let successCount = 0
    let rateLimitCount = 0
    let otherCount = 0

    for (let b = 0; b < batches; b++) {
        const promises = []
        for (let i = 0; i < batchSize; i++) {
            promises.push(sendRequest('/api/verify', 'GET', null))
        }
        
        const results = await Promise.all(promises)
        for (const res of results) {
            if (res.statusCode === 401) {
                successCount++ // Normal unauthenticated response
            } else if (res.statusCode === 429) {
                rateLimitCount++
            } else {
                otherCount++
            }
        }
        process.stdout.write(`Sent ${Math.min((b + 1) * batchSize, 1005)} requests...\r`)
        await new Promise(r => setTimeout(r, 50)) // tiny pause between batches
    }

    const duration = ((Date.now() - start) / 1000).toFixed(2)
    console.log(`\n\nCompleted 1005 requests in ${duration}s.`)
    console.log(`- 401 Unauthorized (Bypassed Rate Limit): ${successCount}`)
    console.log(`- 429 Too Many Requests (Rate Limited): ${rateLimitCount}`)
    if (otherCount > 0) {
        console.log(`- Other Responses: ${otherCount}`)
    }

    if (rateLimitCount > 0) {
        console.log('\n🎉 SUCCESS: General API rate limiting triggered successfully for unauthenticated requests!')
        console.log('Verify this on your admin panel at https://clyo.weexnes.dev/admin under the "API" rate limiter.')
    } else {
        console.log('\n❌ API rate limiting was not triggered. Check if your IP is whitelisted or if the limit was changed.')
    }
}

function sendRequest(path, method, payload) {
    return new Promise((resolve) => {
        const options = {
            hostname: TARGET_HOST,
            port: 443,
            path: path,
            method: method,
            headers: {}
        }

        let bodyStr = ''
        if (payload) {
            bodyStr = JSON.stringify(payload)
            options.headers['Content-Type'] = 'application/json'
            options.headers['Content-Length'] = Buffer.byteLength(bodyStr)
        }

        const req = https.request(options, (res) => {
            let data = ''
            res.on('data', chunk => data += chunk)
            res.on('end', () => {
                let body = data
                try {
                    body = JSON.parse(data)
                } catch {}
                resolve({ statusCode: res.statusCode, body })
            })
        })

        req.on('error', (err) => {
            resolve({ statusCode: 0, body: { message: err.message } })
        })

        if (bodyStr) {
            req.write(bodyStr)
        }
        req.end()
    })
}

runTests()

const fetch = require('cross-fetch')
const formData = require('form-data')
const sharp = require('sharp')
const scraper = require('./scrapper')


// Find img on web page and download
async function getImage(url){
    const response = await fetch(url)
    const type = response.headers.get('Content-Type')
    if (type.includes('image/') || !type.includes('text/html'))
        return Buffer.from(await response.arrayBuffer())

    const { image } = scraper( url, await response.text() )

    if (!image)
        return null

    return Buffer.from( await (await fetch(image)).arrayBuffer() )
}

// Resize image if necessary
async function resizeImage(img){
    const Image = sharp(img);
    const info = await Image.metadata()

    const size = {}
    if (info.width < 500) size.width = 500
    if (info.height < 500) size.height = 500
    if (Object.keys(size).length){
        return Image.resize(size, {fit: 'contain'}).toBuffer()
    }

    return img
}

// Get and upload image
async function uploadByUrl(imgUrl, serverUrl) {
    console.log('uploadByUrl', imgUrl, serverUrl);
    const image = await resizeImage( await getImage(imgUrl) )
    // const image = await getImage(imgUrl)

    const formData = new FormData()
    formData.append('file', image)
    // formData.append('file', image, 'img.' + file_blob.type.split('/')[1])

    return fetch(serverUrl, {
        method : 'post',
        body   : formData
    }).then(r => {
        return r.json()
    }).catch( err => {
        console.warn('Upload to vk request error')
    })
}

module.exports = uploadByUrl
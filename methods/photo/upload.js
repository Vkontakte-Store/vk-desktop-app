const fs = require('fs')
const path = require('path')
const FormData = require('form-data')
const imgSize = require('image-size')
const resizeImg = require('resize-img')
const scraper = require('./scrapper.js')

const nodeFetch = require('node-fetch')
const httpsAgent = new (require('https')).Agent({ rejectUnauthorized: false })
const fetch = (url, options={}) => {
    if (url.includes('https://')) {
        options.agent = httpsAgent
    }
    return nodeFetch(url, options)
};

// Find img on web page and download
async function getImage(url){
    const link = new URL(url)
    
    // local filesystem
    if (link.protocol === 'file:'){
        return new Promise(function(resolve){
            fs.readFile(path.resolve(link.pathname), (err, localImage)=>{
                if (err) reject(err)
                resolve(localImage)
            })
        })
    }

    // download from web
    const response = await fetch(link.href)
    const type = response.headers.get('Content-Type')
    if (type.includes('image/') || !type.includes('text/html'))
        return Buffer.from(await response.arrayBuffer())

    // parse html
    const { image } = scraper( link.href, await response.text() )
    if (!image)
        return null

    return Buffer.from( await (await fetch(image)).arrayBuffer() )
}

// Resize image if necessary
async function resizeImage(img){
    const size = imgSize(img)
    const newSize = {}
    if (size.width < 500) newSize.width = 500
    if (size.height < 500) newSize.height = 500
    if (Object.keys(newSize).length){
        return resizeImg(img, newSize)
    }

    return img
}

// Get and upload image
async function uploadByUrl(imgUrl, serverUrl) {
    const image = await resizeImage( await getImage(imgUrl) )
    
    const formData = new FormData()
    formData.append('file', image, 'img.png')

    return fetch(serverUrl, {
        method : 'post',
        body   : formData,
    }).then(r => {
        return r.json()
    }).catch( err => {
        console.warn('Upload to vk request error')
    })
}

module.exports = uploadByUrl

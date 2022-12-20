// const express = require('express')
// const path = require('path')
// const ethers = require('ethers')
// const { HOST } = require('./src/constants')
// const db = require('./src/database')
// const abi = require('./src/contract.json')
// const { getFileStream } = require('./src/s3')
// require('dotenv').config()

import express from 'express'
import path from 'path'
import ethers from 'ethers'
import { HOST } from './src/constants.js'
import { db } from './src/database.js'
import { abi } from './src/contract.js'
import { getFileStream } from './src/s3.js'
import dotenv  from 'dotenv'
dotenv.config()
const __dirname = path.resolve(path.dirname(''))

const PORT = process.env.PORT || 5000
const alchemyKey = process.env.ALCHEMY_API_KEY
const contractAddress = '0xf47ecc3b549a1e96ffdbd3c1aa421936826f3be5'

async function getMetadata(id) {
  const tokenId = id.toString()
  const index = id - 1
  const artToken = db.data[index]
  const video = artToken.video ? artToken.video : null
  const metadata = {
    'name': artToken.name,
    'attributes': artToken.attributes,
    'description': artToken.description,
    'image': `${HOST}/api/assets/${tokenId}`
  }
  video ? metadata['video'] = video : null
  return metadata
}

async function getTotalSupply() {
  const alchemyProvider = new ethers.providers.AlchemyProvider("mainnet", alchemyKey);
  const contract = new ethers.Contract(
    contractAddress, // contract address
    abi.data, // contract ABI
    alchemyProvider // blockchain node provider
  )
  const totalSupply = await contract.totalSupply();
  return ethers.BigNumber.from(totalSupply).toNumber();
}

getTotalSupply().then((currentSupply) => {
  let totalSupply = ethers.BigNumber.from(currentSupply).toNumber();

  const app = express()
    .set('port', PORT)
    .set('views', path.join(__dirname, 'views'))
    .set('view engine', 'ejs')

  // Static public files
  app.use(express.static(path.join(__dirname, 'public')))

  const webSocket = new ethers.providers.AlchemyWebSocketProvider(
    "mainnet", // mainnet, rinkeby, etc
    alchemyKey // replace with your API key
  )

  const eventFilter = {
    address: contractAddress,
    topics: [
      // Minting emits a Transfer event from the 0x0 address
      ethers.utils.id("Transfer(address,address,uint256)"),
      ethers.utils.hexZeroPad("0x0", 32), 
    ],
  }

  webSocket.on(eventFilter, (event) => {
    let [name, from, to, tokenIdHex] = event.topics;
    let tokenId = ethers.BigNumber.from(tokenIdHex).toNumber();
    if (tokenId > totalSupply) {
      totalSupply = tokenId;
      console.log("increased current supply to ", totalSupply);
    }
  })

  app.get('/', function(req, res) {
    res.render('pages/index')
    // res.send('Check out the project at https://twitter.com/the1973s');
  })

  app.get('/api/token/:token_id', function(req, res) {
    const tokenId = parseInt(req.params.token_id)
    try {
      if (tokenId <= 0) {
        res.status(404).send('Not Found')
      } else if (totalSupply >= tokenId) {
        getMetadata(tokenId)
        .then((metadata) => {
          res.status(200).send(metadata)
        })
      } else {
        res.status(403).send('Forbidden')
      }
    } catch (err) {
      res.status(500).send(err)
    }
  })

  app.get('/api/assets/:token_id', function(req, res) {
    const tokenId = parseInt(req.params.token_id)
    try {
      if (totalSupply >= tokenId) {
        const art = db.data[tokenId]
        const imageKey = `assets/${art.image}`
        const image = getFileStream(imageKey)
        image.pipe(res)
      } else {
        res.status(403).send('Forbidden')
      }
    } catch (err) {
      res.status(500).send(err)
    }
  })

  app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
  })
})
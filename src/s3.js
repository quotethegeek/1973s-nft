// const S3 = require('aws-sdk/clients/s3')
import S3 from 'aws-sdk/clients/s3.js'
import dotenv  from 'dotenv'
dotenv.config()

const bucketName = process.env.AWS_BUCKET_NAME
const region = process.env.AWS_BUCKET_REGION
const accessKeyId = process.env.AWS_ACCESS_KEY_ID
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

const s3 = new S3({
    region,
    accessKeyId,
    secretAccessKey,
})

// function that downloads the image from S3
export function getFileStream(key) {
    try {
        const params = {
            Bucket: bucketName,
            Key: key,
        }
    
        return s3.getObject(params).createReadStream()
    } catch (error) {
        console.log(error)
        return error.message
    }
}
//documentation:read a json file from s3
//https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/globals.html
import {
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
    DeleteObjectCommand,
    ListObjectsCommand
} from "@aws-sdk/client-s3";
import { Readable } from "stream";

function readStream(stream) {
    stream.setEncoding('utf8');
    return new Promise((resolve, reject) => {
        const data = [];
        stream.on("data", chunk => data.push(chunk));
        stream.on("end", () => resolve(data.join()));
        stream.on("error", error => reject(error));
    });
}

//options can be found here:
//https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/interfaces/s3clientconfig.html
//to login use the credentials attribute
//{credentials: {accessKeyId, secretAccessKey, expiration, sessionToken}}
export default function(options = {}){

    //ensure bucket!
    function getBucket(){
        return options.bucket || options.bucketEndpoint;
    }
    if(!getBucket()) throw new Error(`jstor s3: Bucketname is required when creating a jstor S3 strategy`);

    //add credentials and region if needed
    const envs = {
        region: process.env.AWS_DEFAULT_REGION || 'eu-west-1',
        id: process.env.AWS_ACCESS_KEY_ID,
        key: process.env.AWS_SECRET_ACCESS_KEY
    };
    if(!options.region) options.region = envs.region;
    if(!options.credentials?.accessKeyId && envs.id) options.credentials.accessKeyId = envs.id;
    if(!options.credentials?.secretAccessKey && envs.key) options.credentials.secretAccessKey = envs.key;

    //create s3 client
    const s3Client = new S3Client(options);

    //STORE LOGIC
    return function(store){

        //by default cache the keys for 30 minutes
        //cache the documents for 5
        const defaultStoreOptions = {
            cacheOptions: {
                keys: {
                    maxAge: (30 * 60)
                },
                files: {
                    maxAge: (5 * 60)
                }
            }
        };
        store.setOptions(Object.assign(defaultStoreOptions, options));

        const reJsonExtension = /\.json$/i;

        function getCmdParams(key){
            const params = {Bucket: getBucket()};
            if(key) params.Key = `${options.keyPrefix || ''}${key}.json`;
            return params;
        }

        return {

            async get(key){
                const getParams = getCmdParams(key);
                const cmd = new GetObjectCommand(getParams);
                const s3Resp = await s3Client.send(cmd);
                const s3Stream = s3Resp.Body;
                if(s3Stream instanceof Readable){
                    const data = await readStream(s3Stream);
                    return data;
                }else{
                   throw new Error(`jstor s3: No readable stream found for ${key}`) ;
                }
            },

            async save(key, document){
                const saveParams = getCmdParams(key);
                saveParams.Body = JSON.stringify(document, null, 3);
                const cmd = new PutObjectCommand(saveParams);
                await s3Client.send(cmd);
                return document;
            },

            async remove(key){
                const deleteParams = getCmdParams(key);
                const cmd = new DeleteObjectCommand(deleteParams);
                const deletionResult = await s3Client.send(cmd);
                if(deletionResult.Errors){
                    throw new Error(deletionResult.Errors)
                }else{
                    return true;
                }
            },

            async keys(){
                const listParams = getCmdParams();
                if(options.keyPrefix) listParams.Prefix = options.keyPrefix;
                const cmd = new ListObjectsCommand(listParams);
                const keys = await s3Client.send(cmd);
                if(Array.isArray(keys.Contents)){
                    return keys.Contents.map(
                        keyData => {
                            const key = keyData.Key.replace(reJsonExtension, '');
                            return options.keyPrefix ?
                                key.substring(options.keyPrefix.length, key.length) :
                                key;
                        }
                    );
                }else{
                    throw new Error(`Could not get keys for bucket ${getBucket}`);
                }
            }

        };

    }

}
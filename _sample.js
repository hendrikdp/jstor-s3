import Store from 'jstor';
import StrategyS3 from './jstor-s3.js';

//set credentials through the credentials parameters
//OR use the environment variables
//AWS_ACCESS_KEY_ID
//AWS_SECRET_ACCESS_KEY
//Region can be set through environment variables as well
//AWS_DEFAULT_REGION
const credentials = {
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.ACCESS_KEY_SECRET
}

const storage = new Store({
    strategy: StrategyS3({
        bucket: 'jstor-s3-sample',
        region: 'eu-west-1',
        credentials,
        cacheOptions: {
            files: {
                maxAge: 1 //only store the documents 1 second in memory
            }
        },
        keyPrefix: 'jstor/'
    })
});

//create document in s3 bucket
await storage.save('helloWorld', {foo: 'bar'});

//get document from s3 bucket
let file = await storage.get('helloWorld');

//save document
file.set('foo', 'barzzz');
file.save();
console.log("file", file.json());

//get all s3 keys
let keys = await storage.keys();
console.log('keys', keys);

//delete document from s3
await storage.remove('helloWorld');

//show keys after removing hello world
keys = await storage.keys();
console.log('keys after remove', keys);

//read from AWS (the cache should now be invalidated!)
setTimeout(async ()=>{
    let file = await storage.get('helloWorld');
    console.log("file", file.json());
}, 2000)
const { MongoClient, ServerApiVersion  } = require('mongodb')
const { convertFromUtcToLocalDate, monthsAsTextList, numDaysInMonth } = require('./helper');


const MONGODB_DEFAULTS = {
  url: 'mongodb+srv://' + `${process.env.MONGODB_USER}` + ':' + `${process.env.MONGODB_PSW}` + `${process.env.MONGODB_URI}`,
  database: `${process.env.MONGODB_DATABASE}`,
  collection: `${process.env.MONGODB_COLLECTION}`
}

const mongoClient = new MongoClient(MONGODB_DEFAULTS.url, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const dbHandler = async (opType, context) => {
  //console.log("    dbHandler(), opType: ", opType);
  let rsp;
  try {
    const clientPromise = await mongoClient.connect({ maxIdleTimeMS : 270000, minPoolSize : 2, maxPoolSize : 4 });
    const database = clientPromise.db(MONGODB_DEFAULTS.database);
    const collection = database.collection(MONGODB_DEFAULTS.collection);
    
    if (opType === 'update') {
      rsp = await collection.updateOne(context.identifier, context.data);
      rsp = rsp.acknowledged;
    } else if (opType === 'create') { 
      rsp = await collection.insertOne(context);
      rsp = rsp.acknowledged;
    } else if (opType === 'get') {
      rsp = await collection.findOne(context);
    } else if (opType === 'ping') {
      // Send a ping to confirm a successful connection
      rsp = false;
      await mongoClient.db("admin").command({ ping: 1 });
      console.log("    dbHandler(), Pinged your deployment. You successfully connected to MongoDB!");
      rsp = true;
    }
  } catch (error) {
    console.log("ERROR:  dbHandler(), fetching data from DB!");
    console.log(error.toString());
    rsp = null;
  } finally {
    // Ensures that the client will close when you finish/error
    await mongoClient.close();
    //console.log("    dbHandler(), Successfully dis-connected from MongoDB!");
    return (rsp);
  } 
}

const createDbDayObject = (dateStr) => {
  hrObj = {
    produced: 0.0,
    isComplete: false
  }
  dayObj = {
    date: dateStr.split('T')[0],
    produced: 0.0,
    hours: []
  }
  for(let i=0; i<24; i++) {
    dayObj.hours[i] =  Object.assign({}, hrObj);
  }
  return dayObj;
}

const createDbMonthObj = (dateStr) => {
  [year, month, day, ...rest] = dateStr.split('T')[0].split('-');
  dbMonthObj = {
    year: parseInt(year),
    monthName: monthsAsTextList[month-1], // monthNr  0-11
    monthlyPwrData: {
      produced: 0.0
    },
    dailyPwrData: []
  }
  // If it isn't 1:th of month, then create day objects until 'yesterday'
  const dayObj = createDbDayObject('');
  for(let i=0; i<(day - 1); i++) { // Until yesterday
    dbMonthObj.dailyPwrData[i] = Object.assign({}, dayObj);
    dbMonthObj.dailyPwrData[i].date = convertFromUtcToLocalDate(new Date(`${year} ${month} ${i+1}`)).toISOString().split('T')[0];
  }
  return dbMonthObj;
}


module.exports = { dbHandler, createDbDayObject, createDbMonthObj }

const express = require('express');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const ejs = require('ejs');
const fs = require('fs');
const axios = require('axios');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;


const uri = "mongodb+srv://calvinhughes03:nH3BNG82TqOFxj4x@budgettracker.onpfea8.mongodb.net/?retryWrites=true&w=majority&appName=budgetTracker"
const client = new MongoClient(uri);

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// let currencyApi; // holds the imported module

// import the CurrencyAPI
// import('@everapi/currencyapi-js').then((module) => {
//     currencyApi = new module.default('cur_live_A675UK7wHJ8QtUKSZ82uOFk6ZHKECfhWWOttmFvK');
// }).catch(error => {
//     console.error("Failed to load CurrencyAPI module:", error);
// });
// const currenciesInput = document.getElementById('currencies');

app.set('views', './templates');

app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.render('homePg'); 
});

app.post('/summary', async (req, res) => {
  const userName = req.body.userName.trim();

  try {
      await client.connect();
      const database = client.db("budgetTracker");
      const purchases = database.collection("purchases");

      const query = { userName: userName };
      const expenses = await purchases.find(query).toArray();

      let categoryTotals = {};
      expenses.forEach(expense => {
          if (categoryTotals[expense.category]) {
              categoryTotals[expense.category] += expense.itemCost;
          } else {
              categoryTotals[expense.category] = expense.itemCost;
          }
      });

      let labels = Object.keys(categoryTotals);
      let data = Object.values(categoryTotals);
      console.log(labels)
      console.log(data)

      res.render('summary', { expenses, userName, labels: JSON.stringify(labels), data: JSON.stringify(data) });

      
  } catch (err) {
      console.error("Cant retrieve expenses:", err);
      res.render('summary', { expenses: [], userName, labels: JSON.stringify([]), data: JSON.stringify([]) });
  } finally {
      await client.close();
  }
});


app.get('/summary', (req, res) => {
  res.render('summary', { expenses: [], userName: '' });
});

app.get('/form', async (req, res) => {
    try {
        const requests =  await axios.get("https://api.currencyapi.com/v3/currencies?apikey=cur_live_A675UK7wHJ8QtUKSZ82uOFk6ZHKECfhWWOttmFvK");
        let currencies = [];
        for(let currency in requests.data.data) {
            currencies.push(currency);
        }
        res.render('formDataEntry', { currencies: currencies });
    } catch (error) {
        console.error('Failed to load currencies:', error);
        res.render('formDataEntry', { currencies: {} });
    }
});

app.post('/submit', async (req, res) => {
  const { itemName, itemCost, currency, category, userName } = req.body;
  let usdCost = parseFloat(itemCost);

  try {
      await client.connect();
      const database = client.db("budgetTracker");
      const purchases = database.collection("purchases");

      // Convert currency to USD if not already USD
      if (currency !== 'USD') {
          const requests = await axios.get(`https://api.currencyapi.com/v3/latest?apikey=cur_live_A675UK7wHJ8QtUKSZ82uOFk6ZHKECfhWWOttmFvK&base_currency=USD&currencies[]=${currency}`, {
            //   base_currency: currency,
            //   currencies: 'USD'
          });
          console.log(requests.data);
          const conversionRate = +requests.data.data[currency].value;
        //   usdCost = requests.data.data.USD.value
          usdCost /= conversionRate; 
      }

      // Create a new purchase document with the USD cost
      const purchase = {
          itemName,
          itemCost: usdCost, 
          currency: 'USD',
          category,
          userName,
          date: new Date() 
      };

      const result = await purchases.insertOne(purchase);
      console.log(`A document was inserted with the _id: ${result.insertedId}`);

      res.send(`
          <p>Purchase recorded successfully!</p>
          <button onclick="location.href='/'">Back to Home Page</button>
          <style>
              button {
                  padding: 10px 20px;
                  background-color: #4CAF50;
                  color: white;
                  border: none;
                  border-radius: 5px;
                  cursor: pointer;
              }
              button:hover {
                  background-color: #45a049;
              }
          </style>
      `);
  } catch (err) {
      console.error("Failed to insert item:", err);
      res.status(500).send("Error recording purchase.");
  } finally {
      await client.close();
  }
});


async function run() {
    try {
        console.log('Connecting to MongoDB...');
        await client.connect();
        console.log('Connected successfully to MongoDB');

        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Failed to connect to MongoDB:', err);
        process.exit(1);
    }
}

run();
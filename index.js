const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

const uri =
  process.env.MONGODB_URI ||
  "mongodb+srv://tradehub:LOVf2oiHqOZcaj8L@cluster0.vuybam0.mongodb.net/?appName=Cluster0";
const dbName = process.env.DB_NAME || "tradehubdb";
const productsCollectionName = process.env.PRODUCTS_COLLECTION || "courses";

app.use(cors());
app.use(express.json());

const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 5000,
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let mongoConnectionPromise = null;

async function connectToMongoDB() {
  if (mongoConnectionPromise) {
    return mongoConnectionPromise;
  }

  mongoConnectionPromise = client.connect();

  try {
    await mongoConnectionPromise;
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
    return client;
  } catch (error) {
    mongoConnectionPromise = null;
    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
}

const productsCollection = client.db(dbName).collection(productsCollectionName);

function getProductFilter(id) {
  return ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
}

async function getProducts(req, res) {
  const limit = Math.min(Number(req.query.limit) || 8, 24);

  try {
    await connectToMongoDB();
    const products = await productsCollection.find({}).limit(limit).toArray();

    res.send(products);
  } catch (error) {
    console.error("Failed to fetch products:", error.message);
    res.status(500).send({ message: error.message || "Failed to fetch products" });
  }
}

async function getProduct(req, res) {
  try {
    await connectToMongoDB();
    const product = await productsCollection.findOne(getProductFilter(req.params.id));

    if (!product) {
      res.status(404).send({ message: "Product not found" });
      return;
    }

    res.send(product);
  } catch (error) {
    console.error("Failed to fetch product:", error.message);
    res.status(500).send({ message: error.message || "Failed to fetch product" });
  }
}

async function createProduct(req, res) {
  try {
    await connectToMongoDB();
    const product = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await productsCollection.insertOne(product);

    res.status(201).send({ ...product, _id: result.insertedId });
  } catch (error) {
    console.error("Failed to create product:", error.message);
    res.status(500).send({ message: error.message || "Failed to create product" });
  }
}

async function updateProduct(req, res) {
  try {
    await connectToMongoDB();
    const { _id, createdAt, ...updates } = req.body;
    const result = await productsCollection.findOneAndUpdate(
      getProductFilter(req.params.id),
      {
        $set: {
          ...updates,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    if (!result) {
      res.status(404).send({ message: "Product not found" });
      return;
    }

    res.send(result);
  } catch (error) {
    console.error("Failed to update product:", error.message);
    res.status(500).send({ message: error.message || "Failed to update product" });
  }
}

async function deleteProduct(req, res) {
  try {
    await connectToMongoDB();
    const result = await productsCollection.deleteOne(getProductFilter(req.params.id));

    if (result.deletedCount === 0) {
      res.status(404).send({ message: "Product not found" });
      return;
    }

    res.send({ deleted: true });
  } catch (error) {
    console.error("Failed to delete product:", error.message);
    res.status(500).send({ message: error.message || "Failed to delete product" });
  }
}

async function healthCheck(req, res) {
  try {
    await connectToMongoDB();
    const collections = await client.db(dbName).listCollections().toArray();

    res.send({
      server: "ok",
      mongodb: "connected",
      database: dbName,
      productsCollection: productsCollectionName,
      collections: collections.map((collection) => collection.name),
    });
  } catch (error) {
    res.status(500).send({
      server: "ok",
      mongodb: "error",
      database: dbName,
      productsCollection: productsCollectionName,
      message: error.message,
    });
  }
}

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/health", healthCheck);
app.get("/products", getProducts);
app.get("/api/products", getProducts);
app.get("/products/:id", getProduct);
app.get("/api/products/:id", getProduct);
app.post("/products", createProduct);
app.post("/api/products", createProduct);
app.put("/products/:id", updateProduct);
app.put("/api/products/:id", updateProduct);
app.patch("/products/:id", updateProduct);
app.patch("/api/products/:id", updateProduct);
app.delete("/products/:id", deleteProduct);
app.delete("/api/products/:id", deleteProduct);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

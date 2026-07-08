import {pool} from "../../config/database.js"
import { insertInventory } from "../../api/inventory/inventory.repository.js";
import { ProductCategory, ProductStatus } from "../models/product.model.js";

export const productSeederSql = `
    INSERT INTO products (name, sku, category, cost_price, sell_price, tax, weight, min_qty, max_qty, status) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
    ON CONFLICT (sku) DO NOTHING
    RETURNING id
`;

const values = [
    // BEVERAGES
    { name: "Coca Cola 330ml Can",           sku: "BEV-CC-330",    category: ProductCategory.BEVERAGES, cost_price: 0.60, sell_price: 1.20,  tax: 12, weight: 0.33,  min_qty: 5,  max_qty: 100, status: ProductStatus.ACTIVE, initialStock: 20 },
    { name: "Pepsi 500ml Bottle",            sku: "BEV-PP-500",    category: ProductCategory.BEVERAGES, cost_price: 0.55, sell_price: 1.10,  tax: 12, weight: 0.5,   min_qty: 5,  max_qty: 100, status: ProductStatus.ACTIVE, initialStock: 20 },
    { name: "Red Bull Energy 250ml",         sku: "BEV-RB-250",    category: ProductCategory.BEVERAGES, cost_price: 1.20, sell_price: 2.50,  tax: 12, weight: 0.25,  min_qty: 5,  max_qty: 50,  status: ProductStatus.ACTIVE, initialStock: 15 },
    { name: "Evian Still Water 1L",          sku: "BEV-EV-1L",     category: ProductCategory.BEVERAGES, cost_price: 0.80, sell_price: 1.80,  tax: 5,  weight: 1.0,   min_qty: 10, max_qty: 200, status: ProductStatus.ACTIVE, initialStock: 50 },
    { name: "Tropicana Orange Juice 1L",     sku: "BEV-TR-OJ-1L",  category: ProductCategory.BEVERAGES, cost_price: 1.50, sell_price: 3.00,  tax: 12, weight: 1.0,   min_qty: 5,  max_qty: 100, status: ProductStatus.ACTIVE, initialStock: 25 },

    // SNACKS
    { name: "Lays Classic Salted 150g",      sku: "SNK-LAY-150",   category: ProductCategory.SNACKS,    cost_price: 0.90, sell_price: 1.80,  tax: 12, weight: 0.15,  min_qty: 10, max_qty: 200, status: ProductStatus.ACTIVE, initialStock: 40 },
    { name: "Pringles Original 165g",        sku: "SNK-PRG-165",   category: ProductCategory.SNACKS,    cost_price: 1.50, sell_price: 3.00,  tax: 12, weight: 0.165, min_qty: 5,  max_qty: 100, status: ProductStatus.ACTIVE, initialStock: 30 },
    { name: "Oreo Original 154g",            sku: "SNK-ORE-154",   category: ProductCategory.SNACKS,    cost_price: 1.20, sell_price: 2.40,  tax: 12, weight: 0.154, min_qty: 5,  max_qty: 100, status: ProductStatus.ACTIVE, initialStock: 30 },
    { name: "KitKat 4 Finger 41.5g",        sku: "SNK-KK-415",    category: ProductCategory.SNACKS,    cost_price: 0.60, sell_price: 1.20,  tax: 12, weight: 0.042, min_qty: 10, max_qty: 150, status: ProductStatus.ACTIVE, initialStock: 50 },
    { name: "Snickers Bar 50g",              sku: "SNK-SNK-50",    category: ProductCategory.SNACKS,    cost_price: 0.70, sell_price: 1.40,  tax: 12, weight: 0.05,  min_qty: 10, max_qty: 150, status: ProductStatus.ACTIVE, initialStock: 50 },

    // GROCERY
    { name: "Himalayan Pink Salt 500g",      sku: "GRO-HPS-500",   category: ProductCategory.GROCERY,   cost_price: 2.00, sell_price: 4.50,  tax: 0,  weight: 0.5,   min_qty: 5,  max_qty: 50,  status: ProductStatus.ACTIVE, initialStock: 20 },
    { name: "Olive Oil Extra Virgin 1L",     sku: "GRO-OO-EV-1L",  category: ProductCategory.GROCERY,   cost_price: 5.00, sell_price: 9.99,  tax: 5,  weight: 1.0,   min_qty: 3,  max_qty: 30,  status: ProductStatus.ACTIVE, initialStock: 15 },
    { name: "Barilla Spaghetti 500g",        sku: "GRO-BAR-SPA",   category: ProductCategory.GROCERY,   cost_price: 1.00, sell_price: 2.20,  tax: 0,  weight: 0.5,   min_qty: 5,  max_qty: 100, status: ProductStatus.ACTIVE, initialStock: 30 },
    { name: "Heinz Ketchup 570g",            sku: "GRO-HNZ-KET",   category: ProductCategory.GROCERY,   cost_price: 1.80, sell_price: 3.50,  tax: 5,  weight: 0.57,  min_qty: 5,  max_qty: 50,  status: ProductStatus.ACTIVE, initialStock: 20 },
    { name: "Nescafe Classic 200g",          sku: "GRO-NES-200",   category: ProductCategory.GROCERY,   cost_price: 4.00, sell_price: 7.99,  tax: 5,  weight: 0.2,   min_qty: 3,  max_qty: 30,  status: ProductStatus.ACTIVE, initialStock: 15 },

    // DAIRY
    { name: "Lurpak Butter 250g",            sku: "DAI-LUR-250",   category: ProductCategory.DAIRY,     cost_price: 2.00, sell_price: 3.80,  tax: 0,  weight: 0.25,  min_qty: 5,  max_qty: 50,  status: ProductStatus.ACTIVE, initialStock: 20 },
    { name: "Philadelphia Cream Cheese 200g",sku: "DAI-PHI-200",   category: ProductCategory.DAIRY,     cost_price: 1.80, sell_price: 3.50,  tax: 0,  weight: 0.2,   min_qty: 5,  max_qty: 50,  status: ProductStatus.ACTIVE, initialStock: 20 },
    { name: "Activia Strawberry Yogurt 4pk", sku: "DAI-ACT-4PK",   category: ProductCategory.DAIRY,     cost_price: 2.00, sell_price: 3.80,  tax: 0,  weight: 0.5,   min_qty: 5,  max_qty: 50,  status: ProductStatus.ACTIVE, initialStock: 20 },
    { name: "Arla Whole Milk 2L",            sku: "DAI-ARL-2L",    category: ProductCategory.DAIRY,     cost_price: 1.50, sell_price: 2.80,  tax: 0,  weight: 2.0,   min_qty: 10, max_qty: 100, status: ProductStatus.ACTIVE, initialStock: 30 },

    // OTHERS — Moleskine intentionally low stock for concurrent order demo
    { name: "Moleskine Classic Notebook A5", sku: "OTH-MOL-A5",    category: ProductCategory.OTHERS,    cost_price: 8.00, sell_price: 16.99, tax: 12, weight: 0.2,   min_qty: 2,  max_qty: 20,  status: ProductStatus.ACTIVE, initialStock: 1  },
];

export const runProductSeeder = async () => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        for (const product of values) {
            const { initialStock, ...productData } = product;

            // insert product
            const result = await client.query(productSeederSql, [
                productData.name,
                productData.sku,
                productData.category,
                productData.cost_price,
                productData.sell_price,
                productData.tax,
                productData.weight,
                productData.min_qty,
                productData.max_qty,
                productData.status
            ]);

            const productRow = result.rows[0];
            if (!productRow) continue; // ON CONFLICT DO NOTHING — already exists

            // insert inventory + movement
            const success = await insertInventory(client, productRow.id, initialStock);
            if (!success) {
                await client.query("ROLLBACK");
                return;
            }
        }

        await client.query("COMMIT");
        console.log("✅ Product seeder complete");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};
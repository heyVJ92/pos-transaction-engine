import { ProductStatus, ProductCategory } from "../models/product.model.js";
import { pool } from "../../config/database.js";

export const productSeederSql = `
    INSERT INTO products (name, sku, category, cost_price, sell_price, tax, weight, status) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
    ON CONFLICT (sku) DO NOTHING
`;

const values = [
    // BEVERAGES
    { name: "Coca Cola 330ml Can",        sku: "BEV-CC-330",    category: ProductCategory.BEVERAGES, cost_price: 0.60, sell_price: 1.20,  tax: 12, weight: 0.33,  status: ProductStatus.ACTIVE },
    { name: "Pepsi 500ml Bottle",         sku: "BEV-PP-500",    category: ProductCategory.BEVERAGES, cost_price: 0.55, sell_price: 1.10,  tax: 12, weight: 0.5,   status: ProductStatus.ACTIVE },
    { name: "Red Bull Energy 250ml",      sku: "BEV-RB-250",    category: ProductCategory.BEVERAGES, cost_price: 1.20, sell_price: 2.50,  tax: 12, weight: 0.25,  status: ProductStatus.ACTIVE },
    { name: "Evian Still Water 1L",       sku: "BEV-EV-1L",     category: ProductCategory.BEVERAGES, cost_price: 0.80, sell_price: 1.80,  tax: 5,  weight: 1.0,   status: ProductStatus.ACTIVE },
    { name: "Tropicana Orange Juice 1L",  sku: "BEV-TR-OJ-1L",  category: ProductCategory.BEVERAGES, cost_price: 1.50, sell_price: 3.00,  tax: 12, weight: 1.0,   status: ProductStatus.ACTIVE },

    // SNACKS
    { name: "Lays Classic Salted 150g",   sku: "SNK-LAY-150",   category: ProductCategory.SNACKS,    cost_price: 0.90, sell_price: 1.80,  tax: 12, weight: 0.15,  status: ProductStatus.ACTIVE },
    { name: "Pringles Original 165g",     sku: "SNK-PRG-165",   category: ProductCategory.SNACKS,    cost_price: 1.50, sell_price: 3.00,  tax: 12, weight: 0.165, status: ProductStatus.ACTIVE },
    { name: "Oreo Original 154g",         sku: "SNK-ORE-154",   category: ProductCategory.SNACKS,    cost_price: 1.20, sell_price: 2.40,  tax: 12, weight: 0.154, status: ProductStatus.ACTIVE },
    { name: "KitKat 4 Finger 41.5g",     sku: "SNK-KK-415",    category: ProductCategory.SNACKS,    cost_price: 0.60, sell_price: 1.20,  tax: 12, weight: 0.042, status: ProductStatus.ACTIVE },
    { name: "Snickers Bar 50g",           sku: "SNK-SNK-50",    category: ProductCategory.SNACKS,    cost_price: 0.70, sell_price: 1.40,  tax: 12, weight: 0.05,  status: ProductStatus.ACTIVE },

    // GROCERY
    { name: "Himalayan Pink Salt 500g",   sku: "GRO-HPS-500",   category: ProductCategory.GROCERY,   cost_price: 2.00, sell_price: 4.50,  tax: 0,  weight: 0.5,   status: ProductStatus.ACTIVE },
    { name: "Olive Oil Extra Virgin 1L",  sku: "GRO-OO-EV-1L",  category: ProductCategory.GROCERY,   cost_price: 5.00, sell_price: 9.99,  tax: 5,  weight: 1.0,   status: ProductStatus.ACTIVE },
    { name: "Barilla Spaghetti 500g",     sku: "GRO-BAR-SPA",   category: ProductCategory.GROCERY,   cost_price: 1.00, sell_price: 2.20,  tax: 0,  weight: 0.5,   status: ProductStatus.ACTIVE },
    { name: "Heinz Ketchup 570g",         sku: "GRO-HNZ-KET",   category: ProductCategory.GROCERY,   cost_price: 1.80, sell_price: 3.50,  tax: 5,  weight: 0.57,  status: ProductStatus.ACTIVE },
    { name: "Nescafe Classic 200g",       sku: "GRO-NES-200",   category: ProductCategory.GROCERY,   cost_price: 4.00, sell_price: 7.99,  tax: 5,  weight: 0.2,   status: ProductStatus.ACTIVE },

    // DAIRY
    { name: "Lurpak Butter 250g",         sku: "DAI-LUR-250",   category: ProductCategory.DAIRY,     cost_price: 2.00, sell_price: 3.80,  tax: 0,  weight: 0.25,  status: ProductStatus.ACTIVE },
    { name: "Philadelphia Cream Cheese 200g", sku: "DAI-PHI-200", category: ProductCategory.DAIRY,   cost_price: 1.80, sell_price: 3.50,  tax: 0,  weight: 0.2,   status: ProductStatus.ACTIVE },
    { name: "Activia Strawberry Yogurt 4pk", sku: "DAI-ACT-4PK", category: ProductCategory.DAIRY,   cost_price: 2.00, sell_price: 3.80,  tax: 0,  weight: 0.5,   status: ProductStatus.ACTIVE },
    { name: "Arla Whole Milk 2L",         sku: "DAI-ARL-2L",    category: ProductCategory.DAIRY,     cost_price: 1.50, sell_price: 2.80,  tax: 0,  weight: 2.0,   status: ProductStatus.ACTIVE },

    // OTHERS — intentionally low stock for demo
    { name: "Moleskine Classic Notebook A5", sku: "OTH-MOL-A5", category: ProductCategory.OTHERS,   cost_price: 8.00, sell_price: 16.99, tax: 12, weight: 0.2,   status: ProductStatus.ACTIVE },
];

export const runProductSeeder = async () => {
    for (const product of values) {
        await pool.query(productSeederSql, Object.values(product));
    }
    console.log("✅ Product seeder complete");
};
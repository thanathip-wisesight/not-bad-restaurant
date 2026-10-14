import type { Category } from "../lib/domain";

type Opt = [name: string, priceDelta: number];
type Dish = [nameTh: string, nameEn: string, price: number, options?: Opt[]];

// 60 common Thai dishes (12 + 12 + 10 + 8 + 8 + 10). Prices in whole THB.
export const MENU: Record<Category, Dish[]> = {
  main: [
    ["ผัดไทยกุ้งสด", "Pad Thai with Shrimp", 80, [["Extra egg", 10], ["Extra shrimp", 30], ["Wrapped in omelette", 15]]],
    ["ข้าวผัดปู", "Crab Fried Rice", 90, [["Extra crab", 40], ["Fried egg", 10]]],
    ["ผัดกะเพราหมูสับ", "Stir-fried Basil Pork on Rice", 60, [["Fried egg", 10], ["Special size", 20], ["Extra spicy", 0]]],
    ["ข้าวมันไก่", "Hainanese Chicken Rice", 55, [["Extra chicken", 20], ["Chicken liver", 10]]],
    ["ข้าวขาหมู", "Braised Pork Leg on Rice", 60, [["Boiled egg", 10], ["Extra pork", 25]]],
    ["ผัดซีอิ๊ว", "Pad See Ew", 65, [["Extra egg", 10], ["Special size", 20]]],
    ["ราดหน้า", "Rad Na", 65, [["Crispy noodles", 5]]],
    ["ข้าวคลุกกะปิ", "Shrimp Paste Fried Rice", 70],
    ["ข้าวหมูแดง", "Red BBQ Pork on Rice", 55, [["Extra crispy pork", 25]]],
    ["ผัดขี้เมา", "Drunken Noodles", 65, [["Fried egg", 10]]],
    ["ข้าวไข่เจียวหมูสับ", "Minced Pork Omelette on Rice", 45, [["Extra egg", 10]]],
    ["ข้าวผัดอเมริกัน", "American Fried Rice", 75],
  ],
  a_la_carte: [
    ["ผัดผักบุ้งไฟแดง", "Stir-fried Morning Glory", 70, [["Extra chili", 0]]],
    ["ไข่เจียวหมูสับ", "Thai Omelette with Minced Pork", 60],
    ["หมูทอดกระเทียม", "Garlic Fried Pork", 120],
    ["ปลากะพงทอดน้ำปลา", "Deep-fried Sea Bass with Fish Sauce", 320, [["Large size", 80]]],
    ["กุ้งอบวุ้นเส้น", "Baked Shrimp with Glass Noodles", 220],
    ["ผัดเปรี้ยวหวาน", "Sweet and Sour Stir-fry", 110, [["Shrimp instead of pork", 30]]],
    ["แกงเขียวหวานไก่", "Green Curry with Chicken", 120],
    ["ส้มตำไทย", "Som Tam Thai", 60, [["Salted egg", 15], ["Extra spicy", 0]]],
    ["ลาบหมู", "Larb Moo", 80],
    ["ไก่ผัดเม็ดมะม่วง", "Cashew Chicken", 130],
    ["ปูผัดผงกะหรี่", "Curry Crab", 380, [["Large size", 150]]],
    ["ยำวุ้นเส้น", "Glass Noodle Salad", 90],
  ],
  soup: [
    ["ต้มยำกุ้งน้ำข้น", "Tom Yum Goong (Creamy)", 180, [["Extra shrimp", 60], ["Hot pot", 30]]],
    ["ต้มยำกุ้งน้ำใส", "Tom Yum Goong (Clear)", 170, [["Extra shrimp", 60]]],
    ["ต้มข่าไก่", "Tom Kha Gai", 140],
    ["แกงจืดเต้าหู้หมูสับ", "Clear Soup with Tofu and Minced Pork", 100],
    ["ต้มแซ่บกระดูกอ่อน", "Spicy Pork Cartilage Soup", 150],
    ["แกงส้มชะอมกุ้ง", "Sour Curry with Shrimp and Cha-om", 160],
    ["ต้มจืดสาหร่าย", "Seaweed Soup", 90],
    ["โป๊ะแตก", "Poh Taek Seafood Soup", 220, [["Hot pot", 30]]],
    ["ต้มโคล้งปลาสลิด", "Smoked Gourami Spicy Soup", 160],
    ["แกงป่าหมู", "Jungle Curry with Pork", 130],
  ],
  special: [
    ["ปูนิ่มทอดกระเทียม", "Garlic Soft-shell Crab", 280],
    ["แกงมัสมั่นเนื้อ", "Beef Massaman Curry", 220, [["Roti", 25]]],
    ["ห่อหมกทะเล", "Seafood Hor Mok", 180],
    ["ปลาหมึกผัดไข่เค็ม", "Squid with Salted Egg", 190],
    ["กุ้งแม่น้ำเผา", "Grilled River Prawns", 450, [["Extra prawn", 200]]],
    ["หมูกรอบผัดพริกเกลือ", "Crispy Pork with Chili Salt", 160],
    ["ข้าวซอยไก่", "Khao Soi Gai", 120, [["Extra chicken", 30]]],
    ["ยำปลาดุกฟู", "Crispy Catfish Salad", 150],
  ],
  dessert: [
    ["ข้าวเหนียวมะม่วง", "Mango Sticky Rice", 120, [["Extra mango", 40]]],
    ["บัวลอยไข่หวาน", "Bua Loy with Sweet Egg", 50],
    ["ทับทิมกรอบ", "Tub Tim Grob", 45],
    ["กล้วยบวชชี", "Bananas in Coconut Milk", 40],
    ["ขนมครก", "Khanom Krok", 40],
    ["ไอศกรีมกะทิ", "Coconut Ice Cream", 45, [["Peanuts", 5], ["Sticky rice", 10]]],
    ["ลอดช่องน้ำกะทิ", "Lod Chong", 40],
    ["สังขยาฟักทอง", "Pumpkin Custard", 55],
  ],
  drink: [
    ["ชาไทยเย็น", "Thai Iced Tea", 45, [["Less sweet", 0], ["Large", 10]]],
    ["ชามะนาว", "Iced Lemon Tea", 40, [["Large", 10]]],
    ["กาแฟเย็น", "Thai Iced Coffee", 45, [["Large", 10]]],
    ["น้ำมะพร้าวอ่อน", "Young Coconut", 60],
    ["น้ำกระเจี๊ยบ", "Roselle Juice", 35],
    ["น้ำลำไย", "Longan Juice", 35],
    ["น้ำเก๊กฮวย", "Chrysanthemum Tea", 35],
    ["โอเลี้ยง", "Oliang (Black Iced Coffee)", 35],
    ["น้ำเปล่า", "Drinking Water", 15],
    ["โค้ก", "Coke", 25],
  ],
};

// Branches and their table counts (restaurant-branches spec). SIAM also exists from the migration.
export const BRANCHES = [
  { code: "SIAM", name: "Not Bad Siam", tables: 10 },
  { code: "ASOK", name: "Not Bad Asok", tables: 6 },
] as const;

// Demo staff accounts (console-access spec). Passwords are for the demo only and are listed in the README.
export const STAFF = [
  { username: "siam.staff", password: "siam-demo", displayName: "Siam Staff", branches: ["SIAM"] },
  { username: "area.manager", password: "manager-demo", displayName: "Area Manager", branches: ["SIAM", "ASOK"] },
] as const;

USE pharmacy_db;

-- -------------------------------------------------------------
-- 1. USERS (1 Admin, 1 Pharmacist, 3 Customers)
-- Passwords:
-- Admin: AdminPassword123!
-- Pharmacist: PharmaPassword123!
-- Customers: CustomerPassword123!
-- -------------------------------------------------------------
INSERT INTO users (user_id, name, email, password_hash, phone, address, role) VALUES
(1, 'Admin User', 'admin@pharmacy.com', '$2b$10$bSaz/Op6VgAKD.7XqG2NcezejpxUa0QTfPWmGy1Vxjwnhz4D14gI6', '+8801711000001', 'Admin HQ, Dhanmondi, Dhaka', 'admin'),
(2, 'Dr. Sarah Khan', 'pharmacist@pharmacy.com', '$2b$10$J7x0N2EgklzLF2qK5p4hwODGNxG3bk6J7XWRsC9uYetJ30udM4UCa', '+8801711000002', 'Central Pharmacy Block, Gulshan, Dhaka', 'pharmacist'),
(3, 'John Doe', 'john.doe@example.com', '$2b$10$ds8RhlIsLw4OBeihlZzatOefx3LDGY7AymbRLtKUKmgdmIQ5WUyxe', '+8801811000003', 'House 12, Road 4, Banani, Dhaka', 'customer'),
(4, 'Jane Smith', 'jane.smith@example.com', '$2b$10$ds8RhlIsLw4OBeihlZzatOefx3LDGY7AymbRLtKUKmgdmIQ5WUyxe', '+8801911000004', 'Apartment 5B, Uttara Sector 3, Dhaka', 'customer'),
(5, 'Rahim Ahmed', 'rahim.ahmed@example.com', '$2b$10$ds8RhlIsLw4OBeihlZzatOefx3LDGY7AymbRLtKUKmgdmIQ5WUyxe', '+8801611000005', '78 Green Road, Panthapath, Dhaka', 'customer');

-- -------------------------------------------------------------
-- 2. CATEGORIES (6 Categories)
-- -------------------------------------------------------------
INSERT INTO categories (category_id, name) VALUES
(1, 'Antibiotics'),
(2, 'Analgesics & Pain Relief'),
(3, 'Cardiovascular & Antihypertensive'),
(4, 'Antidiabetic'),
(5, 'Respiratory & Antiallergic'),
(6, 'Gastrointestinal & Antacids');

-- -------------------------------------------------------------
-- 3. MEDICINES (20 Medicines: OTC & Prescription)
-- -------------------------------------------------------------
INSERT INTO medicines (medicine_id, category_id, name, generic_name, manufacturer, price, requires_prescription) VALUES
(1, 1, 'Amoxicillin 500mg Capsule', 'Amoxicillin Trihydrate', 'Square Pharmaceuticals', 12.50, TRUE),
(2, 1, 'Azithromycin 500mg Tablet', 'Azithromycin Dihydrate', 'Beximco Pharma', 35.00, TRUE),
(3, 1, 'Ciprofloxacin 500mg Tablet', 'Ciprofloxacin HCl', 'Incepta Pharmaceuticals', 18.00, TRUE),
(4, 1, 'Cefuroxime 500mg Tablet', 'Cefuroxime Axetil', 'Renata Limited', 45.00, TRUE),
(5, 2, 'Paracetamol 500mg Fast Relief', 'Paracetamol', 'Square Pharmaceuticals', 2.50, FALSE),
(6, 2, 'Ibuprofen 400mg Film-Coated', 'Ibuprofen', 'Beximco Pharma', 4.00, FALSE),
(7, 2, 'Naproxen 500mg Tablet', 'Naproxen Sodium', 'Renata Limited', 8.00, FALSE),
(8, 2, 'Tramadol 50mg Capsule', 'Tramadol Hydrochloride', 'Incepta Pharmaceuticals', 15.00, TRUE),
(9, 3, 'Amlodipine 5mg Tablet', 'Amlodipine Besylate', 'Square Pharmaceuticals', 6.00, TRUE),
(10, 3, 'Losartan Potassium 50mg', 'Losartan Potassium', 'Beximco Pharma', 9.50, TRUE),
(11, 3, 'Atorvastatin 20mg Tablet', 'Atorvastatin Calcium', 'Incepta Pharmaceuticals', 14.00, TRUE),
(12, 3, 'Metoprolol 50mg Tartrate', 'Metoprolol Tartrate', 'Renata Limited', 7.50, TRUE),
(13, 4, 'Metformin 500mg XR', 'Metformin Hydrochloride', 'Square Pharmaceuticals', 5.00, TRUE),
(14, 4, 'Glimepiride 2mg Tablet', 'Glimepiride', 'Beximco Pharma', 8.00, TRUE),
(15, 4, 'Sitagliptin 50mg Tablet', 'Sitagliptin Phosphate', 'Incepta Pharmaceuticals', 22.00, TRUE),
(16, 5, 'Cetirizine 10mg Tablet', 'Cetirizine Dihydrochloride', 'Square Pharmaceuticals', 3.50, FALSE),
(17, 5, 'Fexofenadine 120mg Tablet', 'Fexofenadine HCl', 'Beximco Pharma', 10.00, FALSE),
(18, 5, 'Salbutamol Inhaler 100mcg', 'Salbutamol', 'Beximco Pharma', 160.00, TRUE),
(19, 6, 'Omeprazole 20mg Capsule', 'Omeprazole', 'Square Pharmaceuticals', 6.00, FALSE),
(20, 6, 'Esomeprazole 40mg Tablet', 'Esomeprazole Magnesium', 'Incepta Pharmaceuticals', 9.00, FALSE);

-- -------------------------------------------------------------
-- 4. BATCHES (2-3 batches per medicine; includes expired, near expiry, low stock)
-- -------------------------------------------------------------
INSERT INTO batches (batch_id, medicine_id, batch_no, quantity, expiry_date) VALUES
-- Med 1: Amoxicillin (prescription)
(1, 1, 'AMX-2024-01', 50, '2027-06-30'),
(2, 1, 'AMX-2024-02', 80, '2027-12-31'),

-- Med 2: Azithromycin (prescription)
(3, 2, 'AZI-2024-01', 30, '2027-04-15'),
(4, 2, 'AZI-2024-02', 45, '2027-09-30'),

-- Med 3: Ciprofloxacin (prescription) - includes EXPIRED batch
(5, 3, 'CIP-EXP-001', 25, '2026-03-01'), -- EXPIRED
(6, 3, 'CIP-2024-02', 60, '2027-10-15'),

-- Med 4: Cefuroxime (prescription) - includes NEAR EXPIRY batch
(7, 4, 'CEF-NEAR-01', 15, '2026-11-28'), -- NEAR EXPIRY (< 30 days)
(8, 4, 'CEF-2024-02', 40, '2027-11-20'),

-- Med 5: Paracetamol (OTC) - multiple active batches for FEFO test + low stock
(9, 5, 'PARA-FEFO-01', 10, '2026-12-20'), -- Earlier expiry (10 qty)
(10, 5, 'PARA-FEFO-02', 100, '2027-08-15'), -- Later expiry (100 qty)
(11, 5, 'PARA-LOW-03', 3, '2027-12-10'), -- LOW STOCK (3 qty)

-- Med 6: Ibuprofen (OTC)
(12, 6, 'IBU-2024-01', 75, '2027-05-10'),
(13, 6, 'IBU-2024-02', 90, '2028-01-15'),

-- Med 7: Naproxen (OTC)
(14, 7, 'NAP-2024-01', 40, '2027-07-22'),
(15, 7, 'NAP-2024-02', 50, '2028-03-30'),

-- Med 8: Tramadol (prescription) - LOW STOCK (< 20)
(16, 8, 'TRA-2024-01', 5, '2027-06-18'),
(17, 8, 'TRA-2024-02', 10, '2027-12-25'),

-- Med 9: Amlodipine (prescription)
(18, 9, 'AML-2024-01', 85, '2027-09-14'),
(19, 9, 'AML-2024-02', 110, '2028-02-28'),

-- Med 10: Losartan (prescription) - NEAR EXPIRY
(20, 10, 'LOS-NEAR-01', 18, '2026-11-30'), -- NEAR EXPIRY (< 30 days)
(21, 10, 'LOS-2024-02', 70, '2027-10-10'),

-- Med 11: Atorvastatin (prescription)
(22, 11, 'ATV-2024-01', 65, '2027-08-05'),
(23, 11, 'ATV-2024-02', 95, '2028-01-20'),

-- Med 12: Metoprolol (prescription)
(24, 12, 'MET-2024-01', 40, '2027-07-07'),
(25, 12, 'MET-2024-02', 55, '2027-11-15'),

-- Med 13: Metformin (prescription)
(26, 13, 'MTF-2024-01', 120, '2027-12-01'),
(27, 13, 'MTF-2024-02', 150, '2028-05-15'),

-- Med 14: Glimepiride (prescription)
(28, 14, 'GLM-2024-01', 35, '2027-04-10'),
(29, 14, 'GLM-2024-02', 60, '2027-10-25'),

-- Med 15: Sitagliptin (prescription) - LOW STOCK (< 10)
(30, 15, 'SIT-LOW-01', 4, '2027-06-30'), -- LOW STOCK (< 10)
(31, 15, 'SIT-2024-02', 4, '2027-12-15'),

-- Med 16: Cetirizine (OTC)
(32, 16, 'CET-2024-01', 90, '2027-05-20'),
(33, 16, 'CET-2024-02', 140, '2028-01-10'),

-- Med 17: Fexofenadine (OTC)
(34, 17, 'FEX-2024-01', 60, '2027-08-18'),
(35, 17, 'FEX-2024-02', 80, '2028-02-14'),

-- Med 18: Salbutamol Inhaler (prescription)
(36, 18, 'SAL-2024-01', 25, '2027-09-01'),
(37, 18, 'SAL-2024-02', 30, '2028-03-15'),

-- Med 19: Omeprazole (OTC)
(38, 19, 'OMP-2024-01', 110, '2027-10-30'),
(39, 19, 'OMP-2024-02', 130, '2028-04-20'),

-- Med 20: Esomeprazole (OTC)
(40, 20, 'ESO-2024-01', 80, '2027-11-12'),
(41, 20, 'ESO-2024-02', 95, '2028-06-18');

-- -------------------------------------------------------------
-- 5. PRESCRIPTIONS (2 Prescriptions: 1 Approved, 1 Pending)
-- -------------------------------------------------------------
INSERT INTO prescriptions (prescription_id, user_id, image_path, status, reviewed_by, uploaded_at) VALUES
(1, 3, 'uploads/rx_sample_approved.jpg', 'approved', 2, '2026-11-01 09:00:00'),
(2, 4, 'uploads/rx_sample_pending.png', 'pending', NULL, '2026-11-10 14:30:00');

-- -------------------------------------------------------------
-- 6. ORDERS (3 Orders: delivered, confirmed, pending)
-- -------------------------------------------------------------
INSERT INTO orders (order_id, user_id, prescription_id, delivery_address, status, total_amount, created_at) VALUES
(1, 3, 1, 'House 12, Road 4, Banani, Dhaka', 'delivered', 95.00, '2026-11-01 10:15:00'),
(2, 3, NULL, 'House 12, Road 4, Banani, Dhaka', 'confirmed', 25.00, '2026-11-05 11:00:00'),
(3, 5, NULL, '78 Green Road, Panthapath, Dhaka', 'pending', 16.00, '2026-11-10 16:45:00');

-- -------------------------------------------------------------
-- 7. ORDER ITEMS (for the 3 orders)
-- -------------------------------------------------------------
-- Order 1: 2 x Amoxicillin (12.50 = 25.00) + 2 x Azithromycin (35.00 = 70.00) => 95.00
INSERT INTO order_items (order_item_id, order_id, medicine_id, quantity, unit_price) VALUES
(1, 1, 1, 2, 12.50),
(2, 1, 2, 2, 35.00),
-- Order 2: 10 x Paracetamol (2.50 = 25.00)
(3, 2, 5, 10, 2.50),
-- Order 3: 4 x Ibuprofen (4.00 = 16.00)
(4, 3, 6, 4, 4.00);

-- -------------------------------------------------------------
-- 8. PAYMENTS (1 per order, 1:1)
-- -------------------------------------------------------------
INSERT INTO payments (payment_id, order_id, method, status, paid_at) VALUES
(1, 1, 'card', 'paid', '2026-11-01 10:20:00'),
(2, 2, 'bkash', 'paid', '2026-11-05 11:05:00'),
(3, 3, 'cash_on_delivery', 'pending', NULL);


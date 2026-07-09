# SpicePOS: Troubleshooting & Error Guide

This document lists the error messages you might encounter while using the SpicePOS application. These errors are built-in safety features to prevent incorrect billing, financial discrepancies, and accidental data loss.

---

## 🛒 Billing & Checkout Errors

### **`Wholesale / Retail price changed for variant... Refresh and retry.`**
* **Reason**: Another user (or another tab) updated the price of an item in the Price Menu while you had that same item sitting in your billing cart. The system blocked the sale to prevent you from selling it at the old, outdated price.
* **Fix**: Refresh your cart or remove and re-add the item so it fetches the new updated price.

### **`Insufficient packet/bulk stock for...`**
* **Reason**: You are trying to bill more items than you currently have in stock. This can also happen if someone else just billed the remaining stock while you were preparing your invoice.
* **Fix**: Check your inventory levels. If you actually have the physical stock, you need to add an Inventory Arrival or Adjustment first before completing the bill.

### **`Variant not found or disabled`**
* **Reason**: The item in your cart was disabled or deleted from the main product catalog before you clicked complete.
* **Fix**: Remove the item from your cart. If you need to sell it, an Admin must re-enable it in the products list.

### **`No Price Menu entry found for this variant. Set a price first.`**
* **Reason**: You are trying to bill an item or print a barcode for an item that hasn't been assigned a price yet.
* **Fix**: Go to the **Price Menu** screen and enter a Retail and Wholesale price for the item.

### **`At least one line required`**
* **Reason**: You clicked "Complete Bill" but the cart is completely empty.
* **Fix**: Add at least one item to the cart before submitting.

---

## 🔒 Permissions & Security Errors

### **`Admin access required`**
* **Reason**: You are trying to perform a sensitive action (like voiding a bill, deleting a user, or clearing data) while logged in as a regular "Staff" user.
* **Fix**: You must switch to an Admin account to perform this action.

### **`Invoice must be voided before it can be deleted`**
* **Reason**: You tried to completely delete a finalized invoice. The system strictly forbids deleting active financial records without a paper trail.
* **Fix**: First, mark the invoice as **VOID**. Once it is voided and the stock is returned, an Admin can safely delete it permanently from the history.

### **`Invoice is already void` / `Invoice is not voided`**
* **Reason**: You are trying to void an invoice that is already voided, or trying to delete an invoice that hasn't been voided yet.
* **Fix**: Check the status badge of the invoice before attempting the action.

---

## 📦 Data Integrity & Input Errors

### **`Quantity must be positive` / `Payment amount must be positive`**
* **Reason**: You entered `0` or a negative number for a quantity or payment amount.
* **Fix**: Enter a valid number greater than 0. If you are trying to do a refund, use the proper Void mechanism.

### **`Name is required` / `Reason is required`**
* **Reason**: You left a mandatory text field blank (like a Customer Name or an Inventory Adjustment reason).
* **Fix**: Fill in the required text box before saving.

### **`PIN must be at least 4 digits`**
* **Reason**: You tried to create a new user or update a PIN with a password that is too short.
* **Fix**: Enter a 4-digit or longer PIN.

---

## 💾 System & Backup Errors

### **`Backup file not found`**
* **Reason**: You tried to restore a database backup, but the file you selected has been moved, renamed, or deleted by the operating system.
* **Fix**: Go to Settings > Backup and select a valid, existing `.db` backup file.

### **`FOREIGN KEY constraint failed`**
* **Reason**: You attempted to delete a core record (like a Product or a Customer) that is actively linked to past invoices or payments. The system protects these records so your past financial history doesn't break.
* **Fix**: If you really need to delete the item, you must first void/delete all invoices and payments associated with it. Usually, it's better to just **Disable** the product instead of deleting it.

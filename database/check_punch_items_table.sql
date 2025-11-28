-- Check if punch_list_items table exists and has correct structure
USE bluebeam_prototype;

-- Check if table exists
SHOW TABLES LIKE 'punch_list_items';

-- Check table structure
DESCRIBE punch_list_items;

-- Check if there are any records
SELECT COUNT(*) as total_punch_items FROM punch_list_items;

-- Check sample data
SELECT * FROM punch_list_items LIMIT 1;






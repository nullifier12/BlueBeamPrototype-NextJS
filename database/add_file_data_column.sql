-- Add file_data column to documents table for storing base64 PDF data
-- Run this after importing the main schema

USE bluebeam_prototype;

ALTER TABLE documents 
ADD COLUMN file_data LONGTEXT NULL AFTER file_url;






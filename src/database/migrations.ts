import pool from './connection';

export const initializeMigrations = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contact (
        id SERIAL PRIMARY KEY,
        "phoneNumber" VARCHAR(20),
        email VARCHAR(255),
        "linkedId" INTEGER,
        "linkPrecedence" VARCHAR(10) NOT NULL DEFAULT 'primary',
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT fk_linked_id FOREIGN KEY ("linkedId") REFERENCES contact(id)
      );
    `);
    
    // Create indexes for faster lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_contact_email ON contact(email) WHERE "deletedAt" IS NULL;
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_contact_phone ON contact("phoneNumber") WHERE "deletedAt" IS NULL;
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_contact_linked_id ON contact("linkedId");
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
};

// Allow running as standalone script
if (require.main === module) {
  initializeMigrations()
    .then(() => {
      console.log('Migration complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

use anyhow::Result;
use sqlx::{postgres::PgPoolOptions, PgPool};

#[derive(Clone)]
pub struct Database {
    pub pool: PgPool,
}

impl Database {
    pub async fn new(database_url: &str) -> Result<Self> {
        let pool = PgPoolOptions::new()
            .max_connections(10)
            .connect(database_url)
            .await?;

        Ok(Self { pool })
    }

    pub async fn run_migrations(&self) -> Result<()> {
        // Use runtime migrations during development to avoid embedding issues
        let migrator = sqlx::migrate::Migrator::new(std::path::Path::new("./migrations")).await?;
        migrator.run(&self.pool).await?;
        Ok(())
    }
}

// Force rebuild to pick up new migrations

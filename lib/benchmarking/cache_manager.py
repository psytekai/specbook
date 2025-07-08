"""Cache management for HTML content to avoid re-scraping during benchmarking"""
import hashlib
import json
import logging
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple
import pandas as pd

logger = logging.getLogger(__name__)


class CacheManager:
    """Manages cached HTML content for benchmarking"""
    
    def __init__(self, cache_dir: str = "data/cache", llm_results_path: str = "01_llmpipeline/llm_results.csv"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True, parents=True)
        self.llm_results_path = Path(llm_results_path)
        
        # SQLite database for cache metadata
        self.db_path = self.cache_dir / "cache.db"
        self._init_db()
        
        # In-memory cache for performance
        self._memory_cache: Dict[str, str] = {}
        
    def _init_db(self):
        """Initialize SQLite database for cache metadata"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS cache_entries (
                    url TEXT PRIMARY KEY,
                    cache_key TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    content_size INTEGER,
                    scrape_method TEXT,
                    status_code INTEGER,
                    created_at TIMESTAMP,
                    last_accessed TIMESTAMP,
                    access_count INTEGER DEFAULT 0,
                    from_llm_results BOOLEAN DEFAULT 0
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_cache_key ON cache_entries(cache_key)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_created_at ON cache_entries(created_at)
            """)
            conn.commit()
            
        logger.info(f"Initialized cache database at {self.db_path}")
    
    def get_cache_key(self, url: str) -> str:
        """Generate cache key from URL"""
        return hashlib.md5(url.encode()).hexdigest()
    
    def check_llm_results(self, url: str) -> bool:
        """Check if URL exists in llm_results.csv with successful scraping"""
        if not self.llm_results_path.exists():
            return False
            
        try:
            df = pd.read_csv(self.llm_results_path)
            # Check if URL exists and was successfully scraped
            url_data = df[df['product_url'] == url]
            if not url_data.empty:
                # Check if scraping was successful
                success = url_data.iloc[0].get('success', False)
                has_content = pd.notna(url_data.iloc[0].get('html_content', None))
                return success and has_content
        except Exception as e:
            logger.warning(f"Error checking llm_results.csv: {e}")
            
        return False
    
    def import_from_llm_results(self, force: bool = False) -> int:
        """Import HTML content from llm_results.csv into cache"""
        if not self.llm_results_path.exists():
            logger.warning(f"LLM results file not found: {self.llm_results_path}")
            return 0
            
        imported_count = 0
        
        try:
            df = pd.read_csv(self.llm_results_path)
            successful_results = df[df['success'] == True]
            
            for _, row in successful_results.iterrows():
                url = row['product_url']
                html_content = row.get('html_content', '')
                
                if pd.notna(html_content) and html_content:
                    # Check if already cached and skip if not forcing
                    if not force and self.has_cached(url):
                        continue
                        
                    # Store in cache
                    metadata = {
                        'scrape_method': row.get('final_method', 'unknown'),
                        'status_code': row.get('status_code', 200),
                        'from_llm_results': True
                    }
                    
                    self.store_html(url, html_content, metadata)
                    imported_count += 1
                    
            logger.info(f"Imported {imported_count} HTML documents from llm_results.csv")
            
        except Exception as e:
            logger.error(f"Error importing from llm_results.csv: {e}")
            
        return imported_count
    
    def get_cached_html(self, url: str) -> Optional[str]:
        """Retrieve cached HTML content for a URL"""
        # Check memory cache first
        if url in self._memory_cache:
            self._update_access_stats(url)
            return self._memory_cache[url]
        
        # Check database
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT file_path FROM cache_entries WHERE url = ?",
                (url,)
            )
            result = cursor.fetchone()
            
            if result:
                file_path = Path(result[0])
                if file_path.exists():
                    try:
                        content = file_path.read_text(encoding='utf-8')
                        # Update memory cache
                        self._memory_cache[url] = content
                        self._update_access_stats(url)
                        return content
                    except Exception as e:
                        logger.error(f"Error reading cached file {file_path}: {e}")
                        
        return None
    
    def store_html(self, url: str, html_content: str, metadata: Optional[Dict[str, Any]] = None) -> bool:
        """Store HTML content in cache"""
        cache_key = self.get_cache_key(url)
        file_path = self.cache_dir / f"{cache_key}.html"
        
        try:
            # Write HTML content to file
            file_path.write_text(html_content, encoding='utf-8')
            
            # Store metadata in database
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO cache_entries 
                    (url, cache_key, file_path, content_size, scrape_method, 
                     status_code, created_at, last_accessed, access_count, from_llm_results)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    url,
                    cache_key,
                    str(file_path),
                    len(html_content),
                    metadata.get('scrape_method', 'unknown') if metadata else 'unknown',
                    metadata.get('status_code', 200) if metadata else 200,
                    datetime.now(),
                    datetime.now(),
                    0,
                    metadata.get('from_llm_results', False) if metadata else False
                ))
                conn.commit()
            
            # Update memory cache
            self._memory_cache[url] = html_content
            
            logger.debug(f"Cached HTML for {url} ({len(html_content)} bytes)")
            return True
            
        except Exception as e:
            logger.error(f"Error caching HTML for {url}: {e}")
            return False
    
    def has_cached(self, url: str) -> bool:
        """Check if URL has cached content"""
        if url in self._memory_cache:
            return True
            
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT COUNT(*) FROM cache_entries WHERE url = ?",
                (url,)
            )
            count = cursor.fetchone()[0]
            return count > 0
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        with sqlite3.connect(self.db_path) as conn:
            # Total entries
            total_entries = conn.execute("SELECT COUNT(*) FROM cache_entries").fetchone()[0]
            
            # Total size
            total_size = conn.execute("SELECT SUM(content_size) FROM cache_entries").fetchone()[0] or 0
            
            # Entries by source
            from_llm_results = conn.execute(
                "SELECT COUNT(*) FROM cache_entries WHERE from_llm_results = 1"
            ).fetchone()[0]
            
            # Most accessed
            most_accessed = conn.execute("""
                SELECT url, access_count 
                FROM cache_entries 
                ORDER BY access_count DESC 
                LIMIT 10
            """).fetchall()
            
            # Cache age
            oldest = conn.execute(
                "SELECT MIN(created_at) FROM cache_entries"
            ).fetchone()[0]
            
            newest = conn.execute(
                "SELECT MAX(created_at) FROM cache_entries"
            ).fetchone()[0]
        
        return {
            "total_entries": total_entries,
            "total_size_mb": total_size / (1024 * 1024),
            "from_llm_results": from_llm_results,
            "from_new_scraping": total_entries - from_llm_results,
            "most_accessed": [{"url": url, "count": count} for url, count in most_accessed],
            "oldest_entry": oldest,
            "newest_entry": newest,
            "memory_cache_size": len(self._memory_cache)
        }
    
    def clear_memory_cache(self):
        """Clear in-memory cache"""
        self._memory_cache.clear()
        logger.info("Cleared memory cache")
    
    def cleanup_old_entries(self, days: int = 30):
        """Remove cache entries older than specified days"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("""
                DELETE FROM cache_entries 
                WHERE created_at < datetime('now', '-{} days')
                RETURNING file_path
            """.format(days))
            
            # Delete files
            deleted_count = 0
            for (file_path,) in cursor.fetchall():
                try:
                    Path(file_path).unlink(missing_ok=True)
                    deleted_count += 1
                except Exception as e:
                    logger.error(f"Error deleting cache file {file_path}: {e}")
                    
            conn.commit()
            
        logger.info(f"Cleaned up {deleted_count} old cache entries")
        return deleted_count
    
    def export_cache_manifest(self, output_path: str):
        """Export cache manifest to CSV"""
        with sqlite3.connect(self.db_path) as conn:
            df = pd.read_sql_query("""
                SELECT url, cache_key, content_size, scrape_method, 
                       status_code, created_at, access_count, from_llm_results
                FROM cache_entries
                ORDER BY created_at DESC
            """, conn)
            
        df.to_csv(output_path, index=False)
        logger.info(f"Exported cache manifest to {output_path}")
        return output_path
    
    def _update_access_stats(self, url: str):
        """Update access statistics for a cache entry"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                UPDATE cache_entries 
                SET last_accessed = ?, access_count = access_count + 1
                WHERE url = ?
            """, (datetime.now(), url))
            conn.commit()
    
    def get_batch_cached_html(self, urls: List[str]) -> Dict[str, Optional[str]]:
        """Get cached HTML for multiple URLs efficiently"""
        results = {}
        
        # Check memory cache first
        for url in urls:
            if url in self._memory_cache:
                results[url] = self._memory_cache[url]
                self._update_access_stats(url)
        
        # Get remaining from disk
        remaining_urls = [url for url in urls if url not in results]
        if remaining_urls:
            with sqlite3.connect(self.db_path) as conn:
                placeholders = ','.join('?' * len(remaining_urls))
                cursor = conn.execute(f"""
                    SELECT url, file_path 
                    FROM cache_entries 
                    WHERE url IN ({placeholders})
                """, remaining_urls)
                
                for url, file_path in cursor.fetchall():
                    try:
                        content = Path(file_path).read_text(encoding='utf-8')
                        results[url] = content
                        self._memory_cache[url] = content
                        self._update_access_stats(url)
                    except Exception as e:
                        logger.error(f"Error reading cached file for {url}: {e}")
                        results[url] = None
        
        # Set None for URLs not in cache
        for url in urls:
            if url not in results:
                results[url] = None
                
        return results
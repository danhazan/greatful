"""
Load testing runner for comprehensive performance validation.

This script runs all load tests and generates a comprehensive performance report.
"""

import asyncio
import time
import json
import sys
import os
from datetime import datetime, timezone
from typing import Dict, Any, List
import subprocess

# Add the app directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from app.core.database import get_db
from app.core.algorithm_performance import algorithm_performance_monitor
from app.core.query_monitor import query_monitor


class LoadTestRunner:
    """Comprehensive load test runner and reporter."""
    
    def __init__(self):
        self.test_results = {}
        self.start_time = None
        self.end_time = None
        self.system_metrics = {}
        
    async def run_all_load_tests(self) -> Dict[str, Any]:
        """Run all load tests and collect results."""
        print("Starting comprehensive load testing suite...")
        self.start_time = time.time()
        
        # Reset performance monitors
        algorithm_performance_monitor.reset_metrics()
        query_monitor.reset_metrics()
        
        # Collect initial system metrics
        self.system_metrics['start'] = await self._collect_system_metrics()
        
        # Define test suites
        test_suites = [
            {
                "name": "Feed Algorithm Load Tests",
                "module": "test_feed_algorithm_load",
                "tests": [
                    "test_feed_algorithm_concurrent_load",
                    "test_feed_algorithm_large_dataset_performance",
                    "test_feed_algorithm_stress_test",
                    "test_feed_algorithm_memory_usage",
                    "test_feed_algorithm_cache_performance_under_load"
                ]
            },
            {
                "name": "Social Interactions Load Tests", 
                "module": "test_social_interactions_load",
                "tests": [
                    "test_emoji_reactions_concurrent_load",
                    "test_share_system_concurrent_load",
                    "test_follow_system_concurrent_load",
                    "test_mention_system_concurrent_load",
                    "test_user_search_concurrent_load",
                    "test_mixed_social_interactions_load"
                ]
            },
            {
                "name": "Notification Batching Load Tests",
                "module": "test_notification_batching_load", 
                "tests": [
                    "test_notification_creation_high_volume",
                    "test_notification_batching_efficiency",
                    "test_notification_retrieval_performance",
                    "test_concurrent_notification_processing",
                    "test_notification_batch_expansion_performance",
                    "test_notification_cleanup_performance"
                ]
            },
            {
                "name": "Image Upload Load Tests",
                "module": "test_image_upload_load",
                "tests": [
                    "test_profile_image_upload_concurrent_load",
                    "test_post_image_upload_concurrent_load", 
                    "test_various_image_formats_performance",
                    "test_image_processing_performance",
                    "test_concurrent_mixed_uploads"
                ]
            },
            {
                "name": "Mobile Performance Load Tests",
                "module": "test_mobile_performance_load",
                "tests": [
                    "test_mobile_feed_loading_performance",
                    "test_mobile_usage_patterns_simulation",
                    "test_mobile_offline_recovery_simulation",
                    "test_mobile_data_usage_optimization",
                    "test_mobile_concurrent_users_realistic_load"
                ]
            }
        ]
        
        # Run test suites
        for suite in test_suites:
            print(f"\n{'='*60}")
            print(f"Running {suite['name']}")
            print(f"{'='*60}")
            
            suite_results = await self._run_test_suite(suite)
            self.test_results[suite['name']] = suite_results
        
        # Collect final system metrics
        self.system_metrics['end'] = await self._collect_system_metrics()
        self.end_time = time.time()
        
        # Generate comprehensive report
        report = await self._generate_comprehensive_report()
        
        print(f"\n{'='*60}")
        print("LOAD TESTING COMPLETE")
        print(f"{'='*60}")
        print(f"Total duration: {self.end_time - self.start_time:.1f} seconds")
        print(f"Report generated: {report['timestamp']}")
        
        return report
    
    async def _run_test_suite(self, suite: Dict[str, Any]) -> Dict[str, Any]:
        """Run a specific test suite."""
        suite_results = {
            "name": suite["name"],
            "tests": {},
            "summary": {
                "total_tests": len(suite["tests"]),
                "passed_tests": 0,
                "failed_tests": 0,
                "total_duration": 0
            }
        }
        
        for test_name in suite["tests"]:
            print(f"\nRunning {test_name}...")
            test_start_time = time.time()
            
            try:
                # Run pytest for specific test
                cmd = [
                    "python", "-m", "pytest", 
                    f"tests/load/{suite['module']}.py::{test_name.replace('test_', 'Test').replace('_', '')}::{test_name}",
                    "-v", "--tb=short"
                ]
                
                result = subprocess.run(
                    cmd,
                    cwd=os.path.join(os.path.dirname(__file__), '..', '..'),
                    capture_output=True,
                    text=True,
                    timeout=300  # 5 minute timeout per test
                )
                
                test_duration = time.time() - test_start_time
                
                if result.returncode == 0:
                    suite_results["tests"][test_name] = {
                        "status": "PASSED",
                        "duration": test_duration,
                        "output": result.stdout
                    }
                    suite_results["summary"]["passed_tests"] += 1
                    print(f"  ✓ {test_name} PASSED ({test_duration:.1f}s)")
                else:
                    suite_results["tests"][test_name] = {
                        "status": "FAILED", 
                        "duration": test_duration,
                        "output": result.stdout,
                        "error": result.stderr
                    }
                    suite_results["summary"]["failed_tests"] += 1
                    print(f"  ✗ {test_name} FAILED ({test_duration:.1f}s)")
                    print(f"    Error: {result.stderr[:200]}...")
                
                suite_results["summary"]["total_duration"] += test_duration
                
            except subprocess.TimeoutExpired:
                test_duration = time.time() - test_start_time
                suite_results["tests"][test_name] = {
                    "status": "TIMEOUT",
                    "duration": test_duration,
                    "error": "Test timed out after 5 minutes"
                }
                suite_results["summary"]["failed_tests"] += 1
                print(f"  ⏰ {test_name} TIMEOUT ({test_duration:.1f}s)")
                
            except Exception as e:
                test_duration = time.time() - test_start_time
                suite_results["tests"][test_name] = {
                    "status": "ERROR",
                    "duration": test_duration,
                    "error": str(e)
                }
                suite_results["summary"]["failed_tests"] += 1
                print(f"  ❌ {test_name} ERROR ({test_duration:.1f}s): {e}")
        
        # Print suite summary
        summary = suite_results["summary"]
        print(f"\n{suite['name']} Summary:")
        print(f"  Total tests: {summary['total_tests']}")
        print(f"  Passed: {summary['passed_tests']}")
        print(f"  Failed: {summary['failed_tests']}")
        print(f"  Duration: {summary['total_duration']:.1f}s")
        
        return suite_results
    
    async def _collect_system_metrics(self) -> Dict[str, Any]:
        """Collect system performance metrics."""
        try:
            import psutil
            
            # CPU and memory metrics
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            # Database metrics
            db_metrics = {}
            try:
                async with get_db().__anext__() as db:
                    # Get database connection pool stats
                    engine = db.get_bind()
                    pool = engine.pool
                    db_metrics = {
                        "pool_size": pool.size(),
                        "checked_in": pool.checkedin(),
                        "checked_out": pool.checkedout(),
                        "overflow": pool.overflow(),
                        "utilization": (pool.checkedout() / pool.size()) * 100 if pool.size() > 0 else 0
                    }
            except Exception as e:
                db_metrics = {"error": str(e)}
            
            # Algorithm performance metrics
            algorithm_metrics = algorithm_performance_monitor.get_performance_report()
            
            # Query performance metrics
            query_metrics = query_monitor.get_performance_report()
            
            return {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "system": {
                    "cpu_percent": cpu_percent,
                    "memory_percent": memory.percent,
                    "memory_available_gb": memory.available / (1024**3),
                    "disk_percent": disk.percent,
                    "disk_free_gb": disk.free / (1024**3)
                },
                "database": db_metrics,
                "algorithm": algorithm_metrics,
                "queries": query_metrics
            }
            
        except Exception as e:
            return {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "error": f"Failed to collect system metrics: {e}"
            }
    
    async def _generate_comprehensive_report(self) -> Dict[str, Any]:
        """Generate comprehensive load testing report."""
        total_tests = sum(suite["summary"]["total_tests"] for suite in self.test_results.values())
        total_passed = sum(suite["summary"]["passed_tests"] for suite in self.test_results.values())
        total_failed = sum(suite["summary"]["failed_tests"] for suite in self.test_results.values())
        total_duration = self.end_time - self.start_time
        
        # Performance summary
        performance_summary = {
            "feed_algorithm_target_met": True,  # Will be updated based on test results
            "social_interactions_stable": True,
            "notification_batching_efficient": True,
            "image_uploads_performant": True,
            "mobile_optimized": True
        }
        
        # Analyze test results for performance targets
        for suite_name, suite_results in self.test_results.items():
            failed_tests = [name for name, result in suite_results["tests"].items() 
                          if result["status"] != "PASSED"]
            
            if "Feed Algorithm" in suite_name and failed_tests:
                performance_summary["feed_algorithm_target_met"] = False
            elif "Social Interactions" in suite_name and failed_tests:
                performance_summary["social_interactions_stable"] = False
            elif "Notification" in suite_name and failed_tests:
                performance_summary["notification_batching_efficient"] = False
            elif "Image Upload" in suite_name and failed_tests:
                performance_summary["image_uploads_performant"] = False
            elif "Mobile" in suite_name and failed_tests:
                performance_summary["mobile_optimized"] = False
        
        # Generate recommendations
        recommendations = []
        if not performance_summary["feed_algorithm_target_met"]:
            recommendations.append("Feed algorithm performance needs optimization - consider caching improvements")
        if not performance_summary["social_interactions_stable"]:
            recommendations.append("Social interactions need stability improvements - check database indexes")
        if not performance_summary["notification_batching_efficient"]:
            recommendations.append("Notification batching needs optimization - review batching logic")
        if not performance_summary["image_uploads_performant"]:
            recommendations.append("Image upload performance needs improvement - consider CDN or compression")
        if not performance_summary["mobile_optimized"]:
            recommendations.append("Mobile performance needs optimization - review response sizes and caching")
        
        if not recommendations:
            recommendations.append("All performance targets met - system ready for production load")
        
        report = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "test_execution": {
                "total_duration_seconds": total_duration,
                "total_tests": total_tests,
                "passed_tests": total_passed,
                "failed_tests": total_failed,
                "success_rate": (total_passed / total_tests) * 100 if total_tests > 0 else 0
            },
            "performance_summary": performance_summary,
            "system_metrics": {
                "start": self.system_metrics.get("start", {}),
                "end": self.system_metrics.get("end", {})
            },
            "test_suites": self.test_results,
            "recommendations": recommendations,
            "production_readiness": {
                "ready": all(performance_summary.values()),
                "critical_issues": [k for k, v in performance_summary.items() if not v],
                "overall_score": sum(performance_summary.values()) / len(performance_summary) * 100
            }
        }
        
        # Save report to file
        report_filename = f"load_test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        report_path = os.path.join(os.path.dirname(__file__), '..', '..', 'reports', report_filename)
        
        # Create reports directory if it doesn't exist
        os.makedirs(os.path.dirname(report_path), exist_ok=True)
        
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\nDetailed report saved to: {report_path}")
        
        return report


async def main():
    """Main entry point for load testing."""
    runner = LoadTestRunner()
    
    try:
        report = await runner.run_all_load_tests()
        
        # Print summary
        print(f"\n{'='*80}")
        print("LOAD TESTING SUMMARY")
        print(f"{'='*80}")
        
        execution = report["test_execution"]
        print(f"Total Tests: {execution['total_tests']}")
        print(f"Passed: {execution['passed_tests']}")
        print(f"Failed: {execution['failed_tests']}")
        print(f"Success Rate: {execution['success_rate']:.1f}%")
        print(f"Duration: {execution['total_duration_seconds']:.1f} seconds")
        
        print(f"\nPerformance Summary:")
        for metric, status in report["performance_summary"].items():
            status_icon = "✓" if status else "✗"
            print(f"  {status_icon} {metric.replace('_', ' ').title()}: {'PASS' if status else 'FAIL'}")
        
        readiness = report["production_readiness"]
        print(f"\nProduction Readiness:")
        print(f"  Overall Score: {readiness['overall_score']:.1f}%")
        print(f"  Ready for Production: {'YES' if readiness['ready'] else 'NO'}")
        
        if readiness["critical_issues"]:
            print(f"  Critical Issues: {', '.join(readiness['critical_issues'])}")
        
        print(f"\nRecommendations:")
        for rec in report["recommendations"]:
            print(f"  • {rec}")
        
        # Exit with appropriate code
        sys.exit(0 if readiness["ready"] else 1)
        
    except Exception as e:
        print(f"Load testing failed with error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
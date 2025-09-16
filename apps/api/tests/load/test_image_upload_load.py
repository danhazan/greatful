"""
Load testing for image upload and storage performance.

Tests image upload system under production load with various
file sizes and formats to validate performance and reliability.
"""

import pytest

pytestmark = pytest.mark.skip(reason="Load tests disabled for development - configure for production deployment")

import asyncio
import time
import random
import io
import os
from typing import Dict, Any, List
from PIL import Image
import httpx

from .conftest import ConcurrentTestRunner, LoadTestMetrics


class ImageGenerator:
    """Generate test images for load testing."""
    
    @staticmethod
    def create_test_image(width: int, height: int, format: str = 'JPEG') -> bytes:
        """Create a test image with specified dimensions and format."""
        # Create a random colored image
        image = Image.new('RGB', (width, height), 
                         color=(random.randint(0, 255), random.randint(0, 255), random.randint(0, 255)))
        
        # Add some random pixels for variety
        pixels = image.load()
        for _ in range(width * height // 10):
            x = random.randint(0, width - 1)
            y = random.randint(0, height - 1)
            pixels[x, y] = (random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))
        
        # Convert to bytes
        buffer = io.BytesIO()
        image.save(buffer, format=format, quality=85 if format == 'JPEG' else None)
        return buffer.getvalue()
    
    @staticmethod
    def get_image_sizes() -> List[Dict[str, Any]]:
        """Get various image sizes for testing."""
        return [
            {"name": "thumbnail", "width": 150, "height": 150, "expected_size_kb": 5},
            {"name": "small", "width": 400, "height": 400, "expected_size_kb": 25},
            {"name": "medium", "width": 800, "height": 600, "expected_size_kb": 80},
            {"name": "large", "width": 1200, "height": 900, "expected_size_kb": 150},
            {"name": "xlarge", "width": 1920, "height": 1080, "expected_size_kb": 300},
            {"name": "profile_square", "width": 500, "height": 500, "expected_size_kb": 40},
            {"name": "post_wide", "width": 1000, "height": 600, "expected_size_kb": 100},
        ]
    
    @staticmethod
    def get_image_formats() -> List[str]:
        """Get supported image formats for testing."""
        return ['JPEG', 'PNG', 'WEBP']


class TestImageUploadLoad:
    """Load tests for image upload and storage performance."""
    
    @pytest.mark.asyncio
    async def test_profile_image_upload_concurrent_load(
        self,
        large_dataset: Dict[str, Any],
        load_test_tokens: Dict[int, str],
        concurrent_test_runner: ConcurrentTestRunner
    ):
        """Test profile image uploads under concurrent load."""
        users = large_dataset['users']
        concurrent_users = 30
        uploads_per_user = 3
        
        image_generator = ImageGenerator()
        
        async def profile_upload_request(client: httpx.AsyncClient, user_id: int, request_id: int):
            """Upload a profile image for load testing."""
            test_user = users[user_id % len(users)]
            # Use real JWT token
            token = load_test_tokens[test_user.id]
            headers = {"Authorization": f"Bearer {token}"}
            
            # Generate test image
            image_formats = ['JPEG', 'PNG', 'WEBP']
            format = random.choice(image_formats)
            image_data = image_generator.create_test_image(500, 500, format)
            
            # Create multipart form data
            files = {
                'profile_image': (f'profile_{request_id}.{format.lower()}', image_data, f'image/{format.lower()}')
            }
            
            response = await client.post(
                "/api/v1/users/me/profile/image",
                headers=headers,
                files=files
            )
            
            assert response.status_code in [200, 201], f"Profile upload failed: {response.status_code}"
            
            data = response.json()
            assert 'profile_image_url' in data
            assert data['profile_image_url'] is not None
            
            return data
        
        # Run concurrent load test
        stats = await concurrent_test_runner.run_concurrent_requests(
            profile_upload_request,
            concurrent_users=concurrent_users,
            requests_per_user=uploads_per_user
        )
        
        # Validate performance
        assert stats["success_rate"] >= 0.95, f"Profile upload success rate {stats['success_rate']:.2%} below 95%"
        assert stats["response_times"]["p95_ms"] < 3000, f"P95 upload time {stats['response_times']['p95_ms']:.1f}ms too slow"
        assert stats["response_times"]["avg_ms"] < 1500, f"Average upload time {stats['response_times']['avg_ms']:.1f}ms too slow"
        
        print(f"Profile image upload load test results:")
        print(f"  Concurrent users: {stats['concurrent_users']}")
        print(f"  Total uploads: {stats['total_operations']}")
        print(f"  Success rate: {stats['success_rate']:.2%}")
        print(f"  Operations/sec: {stats['operations_per_second']:.1f}")
        print(f"  Response times (ms): avg={stats['response_times']['avg_ms']:.1f}, p95={stats['response_times']['p95_ms']:.1f}")
    
    @pytest.mark.asyncio
    async def test_post_image_upload_concurrent_load(
        self,
        large_dataset: Dict[str, Any],
        load_test_tokens: Dict[int, str],
        concurrent_test_runner: ConcurrentTestRunner
    ):
        """Test post image uploads under concurrent load."""
        users = large_dataset['users']
        concurrent_users = 25
        uploads_per_user = 4
        
        image_generator = ImageGenerator()
        
        async def post_upload_request(client: httpx.AsyncClient, user_id: int, request_id: int):
            """Upload a post image for load testing."""
            test_user = users[user_id % len(users)]
            # Use real JWT token
            token = load_test_tokens[test_user.id]
            headers = {"Authorization": f"Bearer {token}"}
            
            # Generate test image (larger for posts)
            image_sizes = image_generator.get_image_sizes()
            size_config = random.choice([s for s in image_sizes if s['name'] in ['medium', 'large', 'post_wide']])
            
            format = random.choice(['JPEG', 'PNG'])
            image_data = image_generator.create_test_image(
                size_config['width'], 
                size_config['height'], 
                format
            )
            
            # Create post with image
            files = {
                'image': (f'post_{request_id}.{format.lower()}', image_data, f'image/{format.lower()}')
            }
            
            data = {
                'content': f'Load test post {request_id} with image by {test_user.username}',
                'post_type': 'photo',
                'is_public': 'true'
            }
            
            response = await client.post(
                "/api/v1/posts",
                headers=headers,
                files=files,
                data=data
            )
            
            assert response.status_code in [200, 201], f"Post upload failed: {response.status_code}"
            
            response_data = response.json()
            assert 'id' in response_data
            assert 'image_url' in response_data
            assert response_data['image_url'] is not None
            
            return response_data
        
        # Run concurrent load test
        stats = await concurrent_test_runner.run_concurrent_requests(
            post_upload_request,
            concurrent_users=concurrent_users,
            requests_per_user=uploads_per_user
        )
        
        # Validate performance
        assert stats["success_rate"] >= 0.95, f"Post upload success rate {stats['success_rate']:.2%} below 95%"
        assert stats["response_times"]["p95_ms"] < 5000, f"P95 upload time {stats['response_times']['p95_ms']:.1f}ms too slow"
        assert stats["response_times"]["avg_ms"] < 2500, f"Average upload time {stats['response_times']['avg_ms']:.1f}ms too slow"
        
        print(f"Post image upload load test results:")
        print(f"  Concurrent users: {stats['concurrent_users']}")
        print(f"  Total uploads: {stats['total_operations']}")
        print(f"  Success rate: {stats['success_rate']:.2%}")
        print(f"  Operations/sec: {stats['operations_per_second']:.1f}")
        print(f"  Response times (ms): avg={stats['response_times']['avg_ms']:.1f}, p95={stats['response_times']['p95_ms']:.1f}")
    
    @pytest.mark.asyncio
    async def test_various_image_formats_performance(
        self,
        large_dataset: Dict[str, Any],
        load_test_tokens: Dict[int, str],
        http_client: httpx.AsyncClient
    ):
        """Test upload performance with various image formats and sizes."""
        users = large_dataset['users']
        test_user = users[0]
        # Use real JWT token
        token = load_test_tokens[test_user.id]
        headers = {"Authorization": f"Bearer {token}"}
        
        image_generator = ImageGenerator()
        image_sizes = image_generator.get_image_sizes()
        image_formats = image_generator.get_image_formats()
        
        results = []
        
        for size_config in image_sizes:
            for format in image_formats:
                # Generate test image
                image_data = image_generator.create_test_image(
                    size_config['width'],
                    size_config['height'],
                    format
                )
                
                actual_size_kb = len(image_data) / 1024
                
                # Upload image
                files = {
                    'profile_image': (f'test_{size_config["name"]}.{format.lower()}', 
                                    image_data, f'image/{format.lower()}')
                }
                
                start_time = time.time()
                
                response = await http_client.post(
                    "/api/v1/users/me/profile/image",
                    headers=headers,
                    files=files
                )
                
                upload_time_ms = (time.time() - start_time) * 1000
                
                # Validate response
                assert response.status_code in [200, 201], f"Upload failed for {size_config['name']} {format}"
                
                result = {
                    'size_name': size_config['name'],
                    'format': format,
                    'dimensions': f"{size_config['width']}x{size_config['height']}",
                    'actual_size_kb': actual_size_kb,
                    'upload_time_ms': upload_time_ms,
                    'throughput_kbps': (actual_size_kb / upload_time_ms) * 1000 if upload_time_ms > 0 else 0
                }
                results.append(result)
                
                print(f"  {result['size_name']} {result['format']}: {result['actual_size_kb']:.1f}KB in {result['upload_time_ms']:.1f}ms ({result['throughput_kbps']:.1f} KB/s)")
        
        # Analyze results
        avg_upload_time = sum(r['upload_time_ms'] for r in results) / len(results)
        max_upload_time = max(r['upload_time_ms'] for r in results)
        min_throughput = min(r['throughput_kbps'] for r in results)
        
        # Validate performance across all formats and sizes
        assert avg_upload_time < 2000, f"Average upload time {avg_upload_time:.1f}ms across all formats too slow"
        assert max_upload_time < 5000, f"Max upload time {max_upload_time:.1f}ms too slow"
        assert min_throughput > 50, f"Minimum throughput {min_throughput:.1f} KB/s too low"
        
        print(f"Various formats performance summary:")
        print(f"  Test combinations: {len(results)}")
        print(f"  Avg upload time: {avg_upload_time:.1f}ms")
        print(f"  Max upload time: {max_upload_time:.1f}ms")
        print(f"  Min throughput: {min_throughput:.1f} KB/s")
    
    @pytest.mark.asyncio
    async def test_image_processing_performance(
        self,
        large_dataset: Dict[str, Any],
        load_test_tokens: Dict[int, str],
        http_client: httpx.AsyncClient
    ):
        """Test image processing performance (resizing, optimization)."""
        users = large_dataset['users']
        test_user = users[0]
        # Use real JWT token
        token = load_test_tokens[test_user.id]
        headers = {"Authorization": f"Bearer {token}"}
        
        image_generator = ImageGenerator()
        
        # Test with large images that require processing
        large_images = [
            {"width": 2000, "height": 1500, "format": "JPEG"},
            {"width": 1920, "height": 1080, "format": "PNG"},
            {"width": 2400, "height": 1600, "format": "WEBP"},
        ]
        
        processing_times = []
        
        for image_config in large_images:
            # Generate large test image
            image_data = image_generator.create_test_image(
                image_config['width'],
                image_config['height'],
                image_config['format']
            )
            
            original_size_kb = len(image_data) / 1024
            
            files = {
                'profile_image': (f'large_test.{image_config["format"].lower()}', 
                                image_data, f'image/{image_config["format"].lower()}')
            }
            
            start_time = time.time()
            
            response = await http_client.post(
                "/api/v1/users/me/profile/image",
                headers=headers,
                files=files
            )
            
            processing_time_ms = (time.time() - start_time) * 1000
            processing_times.append(processing_time_ms)
            
            # Validate response
            assert response.status_code in [200, 201], f"Processing failed for {image_config['format']}"
            
            data = response.json()
            assert 'profile_image_url' in data
            
            print(f"  {image_config['format']} {image_config['width']}x{image_config['height']}: {original_size_kb:.1f}KB processed in {processing_time_ms:.1f}ms")
        
        # Validate processing performance
        avg_processing_time = sum(processing_times) / len(processing_times)
        max_processing_time = max(processing_times)
        
        assert avg_processing_time < 3000, f"Average processing time {avg_processing_time:.1f}ms too slow"
        assert max_processing_time < 5000, f"Max processing time {max_processing_time:.1f}ms too slow"
        
        print(f"Image processing performance results:")
        print(f"  Test images: {len(large_images)}")
        print(f"  Avg processing time: {avg_processing_time:.1f}ms")
        print(f"  Max processing time: {max_processing_time:.1f}ms")
    
    @pytest.mark.asyncio
    async def test_storage_cleanup_performance(
        self,
        large_dataset: Dict[str, Any],
        load_test_tokens: Dict[int, str],
        http_client: httpx.AsyncClient
    ):
        """Test storage cleanup performance with many files."""
        users = large_dataset['users']
        test_user = users[0]
        # Use real JWT token
        token = load_test_tokens[test_user.id]
        headers = {"Authorization": f"Bearer {token}"}
        
        image_generator = ImageGenerator()
        
        # Upload multiple images to test cleanup
        uploaded_files = []
        
        for i in range(10):
            image_data = image_generator.create_test_image(400, 400, 'JPEG')
            
            files = {
                'profile_image': (f'cleanup_test_{i}.jpg', image_data, 'image/jpeg')
            }
            
            response = await http_client.post(
                "/api/v1/users/me/profile/image",
                headers=headers,
                files=files
            )
            
            assert response.status_code in [200, 201]
            data = response.json()
            uploaded_files.append(data['profile_image_url'])
        
        # Test cleanup operation (this would be done by a background task)
        # For now, we'll just test that the files were uploaded successfully
        assert len(uploaded_files) == 10, "Should have uploaded 10 test files"
        
        # In a real implementation, you would test:
        # - Cleanup of old profile images when new ones are uploaded
        # - Cleanup of orphaned files
        # - Cleanup performance with large numbers of files
        
        print(f"Storage cleanup test results:")
        print(f"  Uploaded files: {len(uploaded_files)}")
        print(f"  All uploads successful")
    
    @pytest.mark.asyncio
    async def test_concurrent_mixed_uploads(
        self,
        large_dataset: Dict[str, Any],
        load_test_tokens: Dict[int, str],
        concurrent_test_runner: ConcurrentTestRunner
    ):
        """Test concurrent mixed uploads (profile + post images)."""
        users = large_dataset['users']
        concurrent_users = 40
        uploads_per_user = 5
        
        image_generator = ImageGenerator()
        
        async def mixed_upload_request(client: httpx.AsyncClient, user_id: int, request_id: int):
            """Perform mixed upload operations for load testing."""
            test_user = users[user_id % len(users)]
            # Use real JWT token
            token = load_test_tokens[test_user.id]
            headers = {"Authorization": f"Bearer {token}"}
            
            # Randomly choose upload type
            upload_types = ['profile', 'post']
            upload_type = random.choice(upload_types)
            
            if upload_type == 'profile':
                # Profile image upload
                image_data = image_generator.create_test_image(500, 500, 'JPEG')
                files = {
                    'profile_image': (f'profile_{request_id}.jpg', image_data, 'image/jpeg')
                }
                
                response = await client.post(
                    "/api/v1/users/me/profile/image",
                    headers=headers,
                    files=files
                )
                
            else:
                # Post image upload
                image_data = image_generator.create_test_image(800, 600, 'JPEG')
                files = {
                    'image': (f'post_{request_id}.jpg', image_data, 'image/jpeg')
                }
                
                data = {
                    'content': f'Mixed upload test post {request_id}',
                    'post_type': 'photo',
                    'is_public': 'true'
                }
                
                response = await client.post(
                    "/api/v1/posts",
                    headers=headers,
                    files=files,
                    data=data
                )
            
            assert response.status_code in [200, 201], f"Mixed upload failed: {response.status_code}"
            return {"upload_type": upload_type}
        
        # Run concurrent load test
        stats = await concurrent_test_runner.run_concurrent_requests(
            mixed_upload_request,
            concurrent_users=concurrent_users,
            requests_per_user=uploads_per_user
        )
        
        # Validate performance
        assert stats["success_rate"] >= 0.95, f"Mixed upload success rate {stats['success_rate']:.2%} below 95%"
        assert stats["response_times"]["p95_ms"] < 4000, f"P95 mixed upload time {stats['response_times']['p95_ms']:.1f}ms too slow"
        assert stats["response_times"]["avg_ms"] < 2000, f"Average mixed upload time {stats['response_times']['avg_ms']:.1f}ms too slow"
        
        print(f"Mixed upload load test results:")
        print(f"  Concurrent users: {stats['concurrent_users']}")
        print(f"  Total uploads: {stats['total_operations']}")
        print(f"  Success rate: {stats['success_rate']:.2%}")
        print(f"  Operations/sec: {stats['operations_per_second']:.1f}")
        print(f"  Response times (ms): avg={stats['response_times']['avg_ms']:.1f}, p95={stats['response_times']['p95_ms']:.1f}")
        
        # Validate sustained throughput
        assert stats["operations_per_second"] > 10, f"Mixed upload throughput {stats['operations_per_second']:.1f} ops/sec too low"
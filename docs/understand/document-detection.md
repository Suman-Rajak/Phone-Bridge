# Document corner detection

The vision workspace takes RGBA frames and returns four source-image pixel coordinates ordered clockwise from the top-left corner, plus a fallback flag. A frame without a contour returns no detection.

1. Cap the longest edge at 320 pixels in preview and 1000 in refine. Convert to grayscale and blur with a 5 × 5 Gaussian kernel.
2. Measure the median grayscale intensity and use 0.67 and 1.33 times that value as the Canny thresholds. Dilate once with a 3 × 3 kernel and retrieve external contours.
3. Rank contours by area. Approximate the five largest with epsilon at 2% of each contour’s perimeter. Keep convex quadrilaterals covering at least 20% of the processed frame.
4. Score by polygon area times rectangularity, where rectangularity is polygon area divided by its minimum-area rotated rectangle area. Use the best candidate or the largest contour’s rotated rectangle with `fallback: true`.
5. Order the points clockwise, starting at the smallest sum of image coordinates, and scale each axis independently back to the input dimensions.

The detector frees temporary OpenCV objects after each call. The browser uses a dedicated worker. A caller can transfer the RGBA buffer with its request, and the worker returns the detection with the same request ID. Node runs the same detector for the tests and benchmark. [OpenCV contour features](https://docs.opencv.org/4.x/dc/dcf/tutorial_js_contour_features.html) · [OpenCV.js packaging decision](../design/adr/0002-opencv-js.md)

The synthetic tests warp text pages through seeded homographies and add blur, noise, and a shadow gradient. The refine check compares each recovered corner to its known source position with a 2-pixel Euclidean tolerance. The SmartDoc benchmark compares the convex quadrilaterals by area of intersection divided by area of union, independent of which corner is first. [SmartDoc sample setup](datasets.md)
